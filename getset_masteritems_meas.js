// Converts master item measures

const enigma = require('enigma.js');
const WebSocket = require('ws');
const schema = require('enigma.js/schemas/3.2.json');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const gh = require('./getset_helper_functions');

if ( argv.hasOwnProperty("h") || !argv.hasOwnProperty("m") || !argv.hasOwnProperty("a")) {
	console.log('\nUsage: node getset_masteritems_meas.js -m=read/write/undo -a appname');
	console.log('Usage: node -h => this message.\n');
	process.exit(1);
}

// Global variables for the app handle and the updates to be made
let app_glob;
let numberOfMasterMeas = 0;
let appname = argv.a; // 'LabelExtract_small.qvf'
var mode = argv.m; // read write undo
let id_counter = 100000;

var logger = fs.createWriteStream(appname.replace(".qvf","") + '_ms_meas.csv', { flags: 'w' });

function writeLine(string) {
	if (gh.isString(string) && string.length > 0 ) {
		logger.write(string + '\n');
	}
};

// First, count objects to modify

const count_session2 = enigma.create({schema,url: 'ws://localhost:9076/app/engineData',createSocket: url => new WebSocket(url)});
count_session2.open()
.then(global => global.openDoc(appname)) 							
.then(app => { 	
	return app.createSessionObject({								
		qMeasureListDef: { qType: 'measure',	qData: { id: "/qInfo/qId" }	},
		qInfo: { qType: 'MeasureList'}
	});		
})
.then(list => list.getLayout()) 									
.then(masterlayout =>	{
	numberOfMasterMeas = masterlayout.qMeasureList.qItems.length;
	count_session2.close()
	.then(() => {				
		console.log('Master meas: ' + numberOfMasterMeas);
	})
});

// Master measures

const session2 = enigma.create({schema,url: 'ws://localhost:9076/app/engineData',createSocket: url => new WebSocket(url)});
session2.open()
.then(global => global.openDoc(appname)) 							
.then(app => { 	
	app_glob = app;
	return app.createSessionObject({								
		qMeasureListDef: { qType: 'measure',	qData: { id: "/qInfo/qId" }	},
		qInfo: { qType: 'MeasureList'}
	});		
})
.then(list => list.getLayout()) 									
.then(masterlayout =>	{
	masterlayout.qMeasureList.qItems.map(function(meas) {			
		app_glob.getMeasure(meas.qInfo.qId)								
		.then(obj => {	
			return Promise.all([obj.getProperties(),obj]) 			
		})
		.then(([visprop,obj]) => {	

			// Master measure label
			// New key, expr in string
			
			if( (!(visprop.qMeasure.hasOwnProperty("qLabelExpression")) || visprop.qMeasure.qLabelExpression == "" ) && 
				visprop.qMetaDef.title != "" ) {
				writeLine(visprop.qMetaDef.title);		
				if ( mode == 'write' ) {
					visprop.qMeasure.qLabelExpression = gh.toTransString(visprop.qMetaDef.title);
				}
			} else {
				if ( mode == 'undo' && gh.isTransString(visprop.qMeasure.qLabelExpression) ) {
					visprop.qMetaDef.title = gh.revertString(visprop.qMeasure.qLabelExpression);
					delete visprop.qMeasure.qLabelExpression;
				}
			}		
		
			// Master measure description
			// New key, expr struct

			if( (!(visprop.qMeasure.hasOwnProperty("descriptionExpression")) || visprop.qMeasure.descriptionExpression == "") && 
				visprop.qMetaDef.description != "" ) {
				writeLine(visprop.qMetaDef.description);
				if ( mode == 'write' ) {
					visprop.qMeasure.descriptionExpression = gh.strToExpr(visprop.qMetaDef.description);
				}
			} else {
				if ( mode == 'undo' && visprop.qMeasure.hasOwnProperty("descriptionExpression") && 
				gh.isTransString(visprop.qMeasure.descriptionExpression.qStringExpression.qExpr) ) {
					visprop.qMetaDef.description = gh.revertString(visprop.qMeasure.descriptionExpression.qStringExpression.qExpr);
					delete visprop.qMeasure.descriptionExpression;
				}
			}
			
			obj.setProperties(visprop)							
			.then(() => {
				numberOfMasterMeas = numberOfMasterMeas - 1;
				if ( numberOfMasterMeas == 0  ) {
					if ( mode == "read" ) {
						session2.close()
						.then(() => { 
							logger.end();
							console.log('Session closed');	
						});
					} else {
						app_glob.doSave() 						
						.then(() => session2.close())
						.then(() => { 
							logger.end();
							console.log('App saved, session closed');	
						})
					}								
				}
			})
		})
	})
});
