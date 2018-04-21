// Extracts sheet title and description

const enigma = require('enigma.js');
const WebSocket = require('ws');
const schema = require('enigma.js/schemas/3.2.json');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const gh = require('./getset_helper_functions');

if ( argv.hasOwnProperty("h") || !argv.hasOwnProperty("m") || !argv.hasOwnProperty("a")) {
	console.log('\nUsage: node getset.js -m=read/write/undo -a appname');
	console.log('Usage: node getset.js -h => this message.\n');
	process.exit(1);
}

// Global variables for the app handle and the updates to be made
let app_glob;
let numberOfSheets = 0;
let appname = argv.a; // 'LabelExtract_small.qvf'
var mode = argv.m; // read write undo
let id_counter = 100000;

var logger = fs.createWriteStream(appname.replace(".qvf","") + '_shts.csv', { flags: 'w' });

function writeLine(string) {
	if (gh.isString(string) && string.length > 0 ) {
		logger.write(string + '\n');
	}
};

// Start session to extract

const session = enigma.create({
  schema,
  url: 'ws://localhost:9076/app/engineData',
  createSocket: url => new WebSocket(url),
});

session.open()
.then(global => global.openDoc(appname)) 							
.then(app => { 	
	app_glob = app; 												
	return app.createSessionObject({								
		qAppObjectListDef: { qType: 'sheet',	qData: { id: "/qInfo/qId" }	},
		qInfo: {qId: 'sheets' + 'List',	qType: 'sheets' + 'List'},
		qMetaDef: {}, qExtendsId: ''
	});		
})
.then(list => list.getLayout())
.then(applayout =>	{	
	numberOfSheets = applayout.qAppObjectList.qItems.length;
	applayout.qAppObjectList.qItems.map(function(sheet) {					
				
		// Sheet title and description
		// New keys for the expressions, with object
		
		app_glob.getObject(sheet.qInfo.qId)			
		.then(obj => {	
			return Promise.all([obj.getProperties(),obj]) 			
		})
		.then(([sheetprop,obj]) => {
			if( (!(sheetprop.hasOwnProperty("labelExpression")) || sheetprop.labelExpression == "" ) && 
				sheetprop.qMetaDef.title != "" ) {
				writeLine(sheetprop.qMetaDef.title);		
				if ( mode == 'write' ) {
					sheetprop.labelExpression = gh.strToExpr(sheetprop.qMetaDef.title);
				}
			} else {
				if ( mode == 'undo' && gh.isTransString(sheetprop.labelExpression.qStringExpression.qExpr) ) {
					sheetprop.qMetaDef.title = gh.revertString(sheetprop.labelExpression.qStringExpression.qExpr);
					delete sheetprop.labelExpression;
				}
			}
			
			if( (!(sheetprop.hasOwnProperty("descriptionExpression")) || sheetprop.descriptionExpression == "") && 
				sheetprop.qMetaDef.description != "" ) {
				writeLine(sheetprop.qMetaDef.description);
				if ( mode == 'write' ) {
					sheetprop.descriptionExpression = gh.strToExpr(sheetprop.qMetaDef.description);
				}
			} else {
				if ( mode == 'undo' && sheetprop.hasOwnProperty("descriptionExpression") && 
				gh.isTransString(sheetprop.descriptionExpression.qStringExpression.qExpr) ) {
					sheetprop.qMetaDef.description = gh.revertString(sheetprop.descriptionExpression.qStringExpression.qExpr);
					delete sheetprop.descriptionExpression;
				}
			}
			
			obj.setProperties(sheetprop)							
			.then(() => {
				console.log("Sheet nr: " + numberOfSheets);
				numberOfSheets = numberOfSheets - 1;
				if ( numberOfSheets == 0 ) {
					if ( mode == "read" ) {
						session.close()
						.then(() => { 
						logger.end();
							console.log('Session closed');	
						});
					} else {
						app_glob.doSave() 						
						.then(() => session.close())
						.then(() => { 
							logger.end();
							console.log('Sheets saved, session closed');	
						})
					}
				}				
			})
		});
	})
})
.catch(err => console.log('Something went wrong :(', err))