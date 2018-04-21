// Converts master item dimensions

const enigma = require('enigma.js');
const WebSocket = require('ws');
const schema = require('enigma.js/schemas/3.2.json');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const gh = require('./getset_helper_functions');

if ( argv.hasOwnProperty("h") || !argv.hasOwnProperty("m") || !argv.hasOwnProperty("a")) {
	console.log('\nUsage: node getset.js -m=read/write/undo -a appname');
	console.log('Usage: node -h => this message.\n');
	process.exit(1);
}

// Global variables for the app handle and the updates to be made
let app_glob;
let numberOfMasterDim = 0;
let appname = argv.a; // 'LabelExtract_small.qvf'
var mode = argv.m; // read write undo
let id_counter = 100000;

var logger = fs.createWriteStream(appname.replace(".qvf","") + '_ms_dim.csv', { flags: 'w' });

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
		qDimensionListDef: { qType: 'dimension',	qData: { id: "/qInfo/qId" }	},
		qInfo: { qType: 'DimensionList'}
	});		
})
.then(list => list.getLayout()) 									
.then(masterlayout =>	{
	numberOfMasterDim = masterlayout.qDimensionList.qItems.length;
	count_session2.close()
	.then(() => {				
		console.log('Master dim: ' + numberOfMasterDim);
	})
});

// Master dimensions

const session2 = enigma.create({schema,url: 'ws://localhost:9076/app/engineData',createSocket: url => new WebSocket(url)});
session2.open()
.then(global => global.openDoc(appname)) 							
.then(app => { 	
	app_glob = app;
	return app.createSessionObject({								
		qDimensionListDef: { qType: 'dimension',	qData: { id: "/qInfo/qId" }	},
		qInfo: { qType: 'DimensionList'}
	});		
})
.then(list => list.getLayout()) 									
.then(masterlayout =>	{
	masterlayout.qDimensionList.qItems.map(function(dim) {			
		app_glob.getDimension(dim.qInfo.qId)								
		.then(obj => {	
			return Promise.all([obj.getProperties(),obj]) 			
		})
		.then(([visprop,obj]) => {	

			// Master dimension label
			// New key, expr in string
			
			if( (!(visprop.qDim.hasOwnProperty("qLabelExpression")) || visprop.qDim.qLabelExpression == "" ) && 
				visprop.qMetaDef.title != "" ) {
				writeLine(visprop.qMetaDef.title);		
				if ( mode == 'write' ) {
					visprop.qDim.qLabelExpression = gh.toTransString(visprop.qMetaDef.title);
				}
			} else {
				if ( mode == 'undo' && gh.isTransString(visprop.qDim.qLabelExpression) ) {
					visprop.qMetaDef.title = gh.revertString(visprop.qDim.qLabelExpression);
					delete visprop.qDim.qLabelExpression;
				}
			}		
		
			// Master dimension description
			// New key, expr struct

			if( (!(visprop.qDim.hasOwnProperty("descriptionExpression")) || visprop.qDim.descriptionExpression == "") && 
				visprop.qMetaDef.description != "" ) {
				writeLine(visprop.qMetaDef.description);
				if ( mode == 'write' ) {
					visprop.qDim.descriptionExpression = gh.strToExpr(visprop.qMetaDef.description);
				}
			} else {
				if ( mode == 'undo' && visprop.qDim.hasOwnProperty("descriptionExpression") && 
				gh.isTransString(visprop.qDim.descriptionExpression.qStringExpression.qExpr) ) {
					visprop.qMetaDef.description = gh.revertString(visprop.qDim.descriptionExpression.qStringExpression.qExpr);
					delete visprop.qDim.descriptionExpression;
				}
			}
			
			obj.setProperties(visprop)							
			.then(() => {
				numberOfMasterDim = numberOfMasterDim - 1;
				if ( numberOfMasterDim == 0  ) {
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
