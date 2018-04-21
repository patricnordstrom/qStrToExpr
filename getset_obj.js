/*
Script for 
* Extracting strings from Qlik Sense apps to csv file.
* Modifying strings to translations expressions.
* Works on sheet title, descriptions, objects (charts and extensions) title, subtitle, footnote, dimensions, expressions and alternative dimensions and measures.

Requires:

nodejs
npm install enigma
npm install minimist
QS Desktop

*/

const enigma = require('enigma.js');
const WebSocket = require('ws');
const schema = require('enigma.js/schemas/3.2.json');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const gh = require('./getset_helper_functions');

if ( argv.hasOwnProperty("h") || !argv.hasOwnProperty("m") || !argv.hasOwnProperty("a")) {
	console.log('\nUsage: node getset_obj.js -m=read/write/undo -a appname');
	console.log('Usage: node getset_obj.js -h => this message.\n');
	process.exit(1);
}

// Global variables for the app handle and the updates to be made
let app_glob;
let numberOfCharts = 0;
let numberOfSheets = 0;
let numberOfFilterpanes = 0;
let appname = argv.a; // 'LabelExtract_small.qvf'
var mode = argv.m; // read write undo
let id_counter = 100000;

var logger = fs.createWriteStream(appname.replace(".qvf","") + '_obj.csv', { flags: 'w' });

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
	console.log(numberOfSheets + " sheets.");	
	applayout.qAppObjectList.qItems.map(function(sheet) {					
			
		// Charts
		
		app_glob.getObject(sheet.qInfo.qId)		
		.then(sheet => sheet.getLayout())
		.then(sheetlayout => {			
			numberOfCharts = numberOfCharts + sheetlayout.cells.length;
			console.log(numberOfCharts + " charts.");
			sheetlayout.cells.map( function(child) {
				app_glob.getObject(child.name)
				.then(obj => {	
					return Promise.all([obj.getProperties(),obj])
				})
				.then(([prop,obj]) => {	
									
					// Object Title, subtitle and footnote
					// Same keys but with object for the expressions

					if( prop.qInfo.qType != "filterpane" ) {
						writeLine(prop.title);
						writeLine(prop.subtitle);
						writeLine(prop.footnote);
						prop.title = gh.convStrToExpr(prop.title, mode);					
						prop.subtitle = gh.convStrToExpr(prop.subtitle, mode);
						prop.footnote = gh.convStrToExpr(prop.footnote, mode);		
					
						// Table totals
						// Same key but with object for the expression					
						if( prop.qInfo.qType == "table" && prop.hasOwnProperty("totals") ) {
							writeLine(prop.totals.label);												
							prop.totals.label = gh.convStrToExpr(prop.totals.label,mode);
						}
						
						// Textbox markdown
						// Text in measure
			
						if ( prop.hasOwnProperty("markdown" ) ) {
							
							// Workaround replacing , to make set search expr work
							var cleantext = prop.markdown.split(",").join(";"); 
							
							if ( !prop.markdown.includes("[](") ) {
								writeLine(cleantext);
							}						
							if( mode == 'write' && !(prop.markdown.includes("[](")) ) {
								var markdownid = ("text" + id_counter).split("0").join("a");
								id_counter = id_counter + 1;
								markdownExpr = {  qDef: { cId: markdownid, qDef: gh.toTransString(cleantext) } };
								prop.qHyperCubeDef.qMeasures.push( markdownExpr );
								prop.markdown = "=[](" + markdownid + ")";
								
							} else {
								if( mode == 'undo' ) {
									var meas = prop.qHyperCubeDef.qMeasures;
									if ( meas.length == 1) {
										if(gh.isTransString(meas[0].qDef.qDef) ) { 
											prop.markdown = gh.revertString(meas[0].qDef.qDef).split(";").join(",");;
											prop.qHyperCubeDef.qMeasures.shift();
										}
									}
								}
							}
						}

						// New mapobject
						
						if ( prop.hasOwnProperty("gaLayers") ) {
							prop.gaLayers.map( function(maplayer) {

								// Map layer dimension labels
								// New key for the expression, only string.

								if( maplayer.hasOwnProperty("qHyperCubeDef")) {
									if( maplayer.qHyperCubeDef.hasOwnProperty("qDimensions")) {
										for (var n = 0; n < maplayer.qHyperCubeDef.qDimensions.length; n++) {
											if(!(maplayer.qHyperCubeDef.qDimensions[n].qDef.hasOwnProperty("qLabelExpression")) && 
												maplayer.qHyperCubeDef.qDimensions[n].qDef.hasOwnProperty("qFieldLabels")) {
												if(maplayer.qHyperCubeDef.qDimensions[n].qDef.qFieldLabels.length >0) {
													writeLine(maplayer.qHyperCubeDef.qDimensions[n].qDef.qFieldLabels[0]);
													if( mode == 'write' ) {
														maplayer.qHyperCubeDef.qDimensions[n].qDef.qLabelExpression = 
															gh.toTransString(maplayer.qHyperCubeDef.qDimensions[n].qDef.qFieldLabels[0]);
													}
												}
											} else {
												if( mode == 'undo' ) {
													maplayer.qHyperCubeDef.qDimensions[n].qDef.qFieldLabels[0] = 
														gh.revertString(maplayer.qHyperCubeDef.qDimensions[n].qDef.qLabelExpression);
													delete maplayer.qHyperCubeDef.qDimensions[n].qDef.qLabelExpression;
												}
											}
										}		
									}
								}
								
								// Alternative dimensions and measures

								if( maplayer.qHyperCubeDef.hasOwnProperty("qLayoutExclude")) {
									
									// Object dimension labels
									// New key for the expression, only string.
								
									if( maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.hasOwnProperty("qDimensions")) {
										var dlen = maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions.length;
										for (var i = 0; i < dlen; i++) {
											if(!(maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
												maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
												if(maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0].length >0) {
													writeLine(maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
													if( mode == 'write' ) {
														maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
															gh.toTransString(maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
													}
												}
											} else {
												if( mode == 'undo' ) {
													maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
														gh.revertString(maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
													delete maplayer.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
												}
											}
										}		
									}
								}
							});							
						}
					
						if( prop.hasOwnProperty("qHyperCubeDef")) {
							
							// Object dimension labels
							// New key for the expression, only string.
						
							if( prop.qHyperCubeDef.hasOwnProperty("qDimensions")) {
								var dlen = prop.qHyperCubeDef.qDimensions.length;
								for (var i = 0; i < dlen; i++) {
									var t_qdef = prop.qHyperCubeDef.qDimensions[i].qDef;
									if(!(prop.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
										prop.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
										if(prop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels.length >0) {
											writeLine(prop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
											if( mode == 'write' ) {
												prop.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
													gh.toTransString(prop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
											}
										}
									} else {
										if( mode == 'undo' ) {
											prop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
												gh.revertString(prop.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
											delete prop.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
										}
									}
								}		
							}
							
							// Object measure labels						
							// New key for the expression, only string.
							
							if( prop.qHyperCubeDef.hasOwnProperty("qMeasures")) {
								var mlen = prop.qHyperCubeDef.qMeasures.length;
								for (var j = 0; j < mlen; j++) {
									if(!( prop.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression"))&& 
										prop.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabel")) {
										writeLine(prop.qHyperCubeDef.qMeasures[j].qDef.qLabel);
										if( mode == 'write' ) {
											prop.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression = 
												gh.toTransString(prop.qHyperCubeDef.qMeasures[j].qDef.qLabel);
										}
									} else {
										if( mode == 'undo' && prop.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression") ) {
											prop.qHyperCubeDef.qMeasures[j].qDef.qLabel = 
												gh.revertString(prop.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression);
											delete prop.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression;
										}
									}
								}
							}

							// Alternative dimensions and measures

							if( prop.qHyperCubeDef.hasOwnProperty("qLayoutExclude")) {
								
								// Object dimension labels
								// New key for the expression, only string.
							
								if( prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.hasOwnProperty("qDimensions")) {
									var dlen = prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions.length;
									for (var i = 0; i < dlen; i++) {
										if(!(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
											prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
											if(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0].length >0) {
												writeLine(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
												if( mode == 'write' ) {
													prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
														gh.toTransString(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
												}
											}
										} else {
											if( mode == 'undo' ) {
												prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
													gh.revertString(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
												delete prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
											}
										}
									}		
								}
								
								// Object measure labels						
								// New key for the expression, only string.
								
								if( prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.hasOwnProperty("qMeasures")) {
									var mlen = prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures.length;
									for (var j = 0; j < mlen; j++) {
										if(!( prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression"))&& 
											prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabel")) {
											writeLine(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel);
											if( mode == 'write' ) {
												prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression = 
													gh.toTransString(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel);
											}
										} else {
											if( mode == 'undo' ) {
												prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel = 
													gh.revertString(prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression);
												delete prop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression;
											}
										}
									}
								}
							}	
						
						}	
						
						// Boxplot
						
						if( prop.hasOwnProperty("boxplotDef")) {
							
							console.log("boxplot");
							
							// Object dimension labels
							// New key for the expression, only string.
						
							if( prop.boxplotDef.qHyperCubeDef.hasOwnProperty("qDimensions")) {
								var dlen = prop.boxplotDef.qHyperCubeDef.qDimensions.length;
								for (var i = 0; i < dlen; i++) {
									if(!(prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
										prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
										if(prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0].length >0) {
											writeLine(prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
											if( mode == 'write' ) {
												prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
													gh.toTransString(prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
											}
										}
									} else {
										if( mode == 'undo' ) {
											prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
												gh.revertString(prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
											delete prop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
										}
									}
								}		
							}
							
							// Object measure labels						
							// New key for the expression, only string.
							
							if( prop.boxplotDef.qHyperCubeDef.hasOwnProperty("qMeasures")) {
								var mlen = prop.boxplotDef.qHyperCubeDef.qMeasures.length;
								for (var j = 0; j < mlen; j++) {
									//console.log(prop.qHyperCubeDef.qMeasures);
									if(!( prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression"))&& 
										prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabel")) {
										writeLine(prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabel);
										if( mode == 'write' ) {
											prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression = 
												gh.toTransString(prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabel);
										}
									} else {
										if( mode == 'undo' ) {
											prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabel = 
												gh.revertString(prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression);
											delete prop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression;
										}
									}
								}
							}
							
							// Alternative dimensions and measures

							if( prop.boxplotDef.qHyperCubeDef.hasOwnProperty("qLayoutExclude")) {
								
								// Object dimension labels
								// New key for the expression, only string.
							
								if( prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.hasOwnProperty("qDimensions")) {
									var dlen = prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions.length;
									for (var i = 0; i < dlen; i++) {
										if(!(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
											prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
											if(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0].length >0) {
												writeLine(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
												if( mode == 'write' ) {
													prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
														gh.toTransString(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
												}
											}
										} else {
											if( mode == 'undo' ) {
												prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
													gh.revertString(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
												delete prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
											}
										}
									}		
								}
								
								// Object measure labels						
								// New key for the expression, only string.
								
								if( prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.hasOwnProperty("qMeasures")) {
									var mlen = prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures.length;
									for (var j = 0; j < mlen; j++) {
										if(!( prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression"))&& 
											prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabel")) {
											writeLine(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel);
											if( mode == 'write' ) {
												prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression = 
													gh.toTransString(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel);
											}
										} else {
											if( mode == 'undo' ) {
												prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel = 
													gh.revertString(prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression);
												delete prop.boxplotDef.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression;
											}
										}
									}
								}
							}	
							
							
							
							
						}
						
						obj.setProperties(prop)
						.then(() => {
							console.log("Obj nr: " + numberOfCharts + ".");
							numberOfCharts = numberOfCharts - 1;
							if ( numberOfCharts == 0 ) {
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
						});		
				    } else {
						console.log("Skipping filterpane " + numberOfCharts);
						numberOfCharts = numberOfCharts - 1;
					}
				})
			})			
		})
	})
})
.catch(err => console.log('Something went wrong :(', err))