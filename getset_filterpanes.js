// Filter panes

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
let numberOfFilterpanes = 0;
let appname = argv.a; // 'LabelExtract_small.qvf'
var mode = argv.m; // read write undo
let id_counter = 100000;

var logger = fs.createWriteStream(appname.replace(".qvf","") + '_fp.csv', { flags: 'w' });

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
	applayout.qAppObjectList.qItems.map(function(sheet) {					
		app_glob.getObject(sheet.qInfo.qId)		
		.then(sheet => sheet.getLayout())
		.then(sheetlayout => {			
			sheetlayout.cells.map( function(child) {
				app_glob.getObject(child.name)
				.then(obj => {	
					return Promise.all([obj.getProperties(),obj])
				})
				.then(([prop,obj]) => {	
									
					// Filter pane, dimensions in childlist
					// Same keys but with object for the expressions
					
					if( prop.qInfo.qType == "filterpane" ) {
						
						numberOfFilterpanes = numberOfFilterpanes +1;
						console.log("numberOfFilterpanes: " + numberOfFilterpanes);
						
						obj.getFullPropertyTree()
						.then( tree => {
							for (var k = 0; k < tree.qChildren.length; k++) {
								writeLine(tree.qChildren[k].qProperty.title);
								tree.qChildren[k].qProperty.title = gh.convStrToExpr(tree.qChildren[k].qProperty.title,mode);	
							}
						
							// Filter pane title, subtitle and footnote

							writeLine(tree.qProperty.title);	
							writeLine(tree.qProperty.subtitle);
							writeLine(tree.qProperty.footnote);														
							tree.qProperty.title = gh.convStrToExpr(tree.qProperty.title,mode);					
							tree.qProperty.subtitle = gh.convStrToExpr(tree.qProperty.subtitle,mode);
							tree.qProperty.footnote = gh.convStrToExpr(tree.qProperty.footnote,mode);		
							
							obj.setFullPropertyTree(tree)
							.then(() => {
								console.log("Pane nr: " + numberOfFilterpanes );

								numberOfFilterpanes = numberOfFilterpanes - 1;
								if ( numberOfFilterpanes == 0 ) {
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
											console.log('App saved, session closed');	
										})
									}
								}
							})
						})
					}						
				})
			})			
		})
	})
})
.catch(err => console.log('Something went wrong :(', err))