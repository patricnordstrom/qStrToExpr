// Works on master dimension label, descriptions, chart title, subtitle, footnote, dimensions, expressions and alternative dimensions and measures.

const enigma = require('enigma.js');
const WebSocket = require('ws');
const schema = require('enigma.js/schemas/3.2.json');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const gh = require('./getset_helper_functions');

if ( argv.hasOwnProperty("h") || !argv.hasOwnProperty("m") || !argv.hasOwnProperty("a")) {
	console.log('\nUsage: node getset_masteritems.js -m=read/write/undo -a appname');
	console.log('Usage: node getset_masteritems -h => this message.\n');
	process.exit(1);
}

// Global variables for the app handle and the updates to be made
let app_glob;
let numberOfMasterVis = 0;
let appname = argv.a; // 'LabelExtract_small.qvf'
var mode = argv.m; // read write undo
let id_counter = 100000;

var logger = fs.createWriteStream(appname.replace(".qvf","") + '_ms.csv', { flags: 'w' });

function writeLine(string) {
	if (gh.isString(string) && string.length > 0 ) {
		logger.write(string + '\n');
	}
};

const session = enigma.create({schema,url: 'ws://localhost:9076/app/engineData',createSocket: url => new WebSocket(url)});
session.open()
.then(global => global.openDoc(appname)) 							
.then(app => { 	
	app_glob = app; 												
	return app.createSessionObject({								
		qAppObjectListDef: { qType: 'masterobject',	qData: { id: "/qInfo/qId" }	},
		qInfo: {qId: 'masterobjectsList', qType: 'masterobjectsList'},
		qMetaDef: {}, qExtendsId: ''
	});		
})
.then(list => list.getLayout()) 								
.then(masterlayout =>	{	

	numberOfMasterVis = numberOfMasterVis + masterlayout.qAppObjectList.qItems.length;
	console.log(numberOfMasterVis + " charts.");

	masterlayout.qAppObjectList.qItems.map(function(vis) {			
		app_glob.getObject(vis.qInfo.qId)							
		.then(obj => {	
			return Promise.all([obj.getProperties(),obj]) 			
		})
		.then(([visprop,obj]) => {

			// Vis title, subtitle and footnote
			// Same keys for the expressions, with object
			
			if( visprop.visualization != "filterpane" ) {

				writeLine(visprop.title);
				writeLine(visprop.subtitle);
				writeLine(visprop.footnote);
				visprop.title = gh.convStrToExpr(visprop.title,mode);
				visprop.subtitle = gh.convStrToExpr(visprop.subtitle,mode);
				visprop.footnote = gh.convStrToExpr(visprop.footnote,mode);
				
				// Vis label and description
				// New keys for the expressions, with object

				if( (!(visprop.hasOwnProperty("labelExpression")) || visprop.labelExpression == "" ) && 
					visprop.qMetaDef.title != "" ) {
					writeLine(visprop.qMetaDef.title);		
					if ( mode == 'write' ) {
						visprop.labelExpression = gh.strToExpr(visprop.qMetaDef.title);
					}
				} else {
					if ( mode == 'undo' && gh.isTransString(visprop.labelExpression.qStringExpression.qExpr) ) {
						visprop.qMetaDef.title = gh.revertString(visprop.labelExpression.qStringExpression.qExpr);
						delete visprop.labelExpression;
					}
				}
							
				if( (!(visprop.hasOwnProperty("descriptionExpression")) || visprop.descriptionExpression == "") && 
					visprop.qMetaDef.description != "" ) {
					writeLine(visprop.qMetaDef.description);
					if ( mode == 'write' ) {
						visprop.descriptionExpression = gh.strToExpr(visprop.qMetaDef.description);
					}
				} else {
					if ( mode == 'undo' && visprop.hasOwnProperty("descriptionExpression") && 
					gh.isTransString(visprop.descriptionExpression.qStringExpression.qExpr) ) {
						visprop.qMetaDef.description = gh.revertString(visprop.descriptionExpression.qStringExpression.qExpr);
						delete visprop.descriptionExpression;
					}
				}
				
				// Table totals
				// Same key but with object for the expression		
				
				if( visprop.visualization == "table" && visprop.hasOwnProperty("totals") ) {
					writeLine(visprop.totals.label);												
					visprop.totals.label = gh.convStrToExpr(visprop.totals.label,mode);
				}

				// Textbox markdown
				// Text in measure

				if ( visprop.hasOwnProperty("markdown" ) ) {
					
					// Workaround replacing , to make set search expr work
					var cleantext = visprop.markdown.split(",").join(";"); 
					
					if ( !visprop.markdown.includes("[](") ) {
						writeLine(cleantext);
					}						
					if( mode == 'write' && !(visprop.markdown.includes("[](")) ) {
						var markdownid = ("text" + id_counter).split("0").join("a");
						id_counter = id_counter + 1;
						markdownExpr = {  qDef: { cId: markdownid, qDef: gh.toTransString(cleantext) } };
						visprop.qHyperCubeDef.qMeasures.push( markdownExpr );
						visprop.markdown = "=[](" + markdownid + ")";
						
					} else {
						if( mode == 'undo' ) {
							var meas = visprop.qHyperCubeDef.qMeasures;
							if ( meas.length == 1) {
								if(gh.isTransString(meas[0].qDef.qDef) ) { 
									visprop.markdown = gh.revertString(meas[0].qDef.qDef).split(";").join(",");;
									visprop.qHyperCubeDef.qMeasures.shift();
								}
							}
						}
					}
				}
				
				// New mapobject
				
				if ( visprop.hasOwnProperty("gaLayers") ) {
					visprop.gaLayers.map( function(maplayer) {

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
				
				// All other objects
				
				if( visprop.hasOwnProperty("qHyperCubeDef")) {
					
					// Object dimension labels
					// New key for the expression, only string.
				
					if( visprop.qHyperCubeDef.hasOwnProperty("qDimensions")) {
						var dlen = visprop.qHyperCubeDef.qDimensions.length;
						for (var i = 0; i < dlen; i++) {
							var t_qdef = visprop.qHyperCubeDef.qDimensions[i].qDef;
							if(!(visprop.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
								visprop.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
								if(visprop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels.length >0) {
									writeLine(visprop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
									if( mode == 'write' ) {
										visprop.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
											gh.toTransString(visprop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
									}
								}
							} else {
								if( mode == 'undo' ) {
									visprop.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
										gh.revertString(visprop.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
									delete visprop.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
								}
							}
						}		
					}
					
					// Object measure labels						
					// New key for the expression, only string.
					
					if( visprop.qHyperCubeDef.hasOwnProperty("qMeasures")) {
						var mlen = visprop.qHyperCubeDef.qMeasures.length;
						for (var j = 0; j < mlen; j++) {
							if(!( visprop.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression"))&& 
								visprop.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabel")) {
								writeLine(visprop.qHyperCubeDef.qMeasures[j].qDef.qLabel);
								if( mode == 'write' ) {
									visprop.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression = 
										gh.toTransString(visprop.qHyperCubeDef.qMeasures[j].qDef.qLabel);
								}
							} else {
								if( mode == 'undo' && visprop.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression") ) {
									visprop.qHyperCubeDef.qMeasures[j].qDef.qLabel = 
										gh.revertString(visprop.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression);
									delete visprop.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression;
								}
							}
						}
					}

					// Alternative dimensions and measures

					if( visprop.qHyperCubeDef.hasOwnProperty("qLayoutExclude")) {
						
						// Object dimension labels
						// New key for the expression, only string.
					
						if( visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.hasOwnProperty("qDimensions")) {
							var dlen = visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions.length;
							for (var i = 0; i < dlen; i++) {
								if(!(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
									visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
									if(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0].length >0) {
										writeLine(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
										if( mode == 'write' ) {
											visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
												gh.toTransString(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
										}
									}
								} else {
									if( mode == 'undo' ) {
										visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
											gh.revertString(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
										delete visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
									}
								}
							}		
						}
						
						// Object measure labels						
						// New key for the expression, only string.
						
						if( visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.hasOwnProperty("qMeasures")) {
							var mlen = visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures.length;
							for (var j = 0; j < mlen; j++) {
								if(!( visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression"))&& 
									visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabel")) {
									writeLine(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel);
									if( mode == 'write' ) {
										visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression = 
											gh.toTransString(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel);
									}
								} else {
									if( mode == 'undo' ) {
										visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabel = 
											gh.revertString(visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression);
										delete visprop.qHyperCubeDef.qLayoutExclude.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression;
									}
								}
							}
						}
					}	
				}	
				
				// Boxplot
				
				if( visprop.hasOwnProperty("boxplotDef")) {
					
					console.log("boxplot");
					
					// Object dimension labels
					// New key for the expression, only string.
				
					if( visprop.boxplotDef.qHyperCubeDef.hasOwnProperty("qDimensions")) {
						var dlen = visprop.boxplotDef.qHyperCubeDef.qDimensions.length;
						for (var i = 0; i < dlen; i++) {
							if(!(visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qLabelExpression")) && 
								visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.hasOwnProperty("qFieldLabels")) {
								if(visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0].length >0) {
									writeLine(visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
									if( mode == 'write' ) {
										visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression = 
											gh.toTransString(visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0]);
									}
								}
							} else {
								if( mode == 'undo' ) {
									visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qFieldLabels[0] = 
										gh.revertString(visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression);
									delete visprop.boxplotDef.qHyperCubeDef.qDimensions[i].qDef.qLabelExpression;
								}
							}
						}		
					}
					
					// Object measure labels						
					// New key for the expression, only string.
					
					if( visprop.boxplotDef.qHyperCubeDef.hasOwnProperty("qMeasures")) {
						var mlen = visprop.boxplotDef.qHyperCubeDef.qMeasures.length;
						for (var j = 0; j < mlen; j++) {
							if(!( visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabelExpression"))&& 
								visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.hasOwnProperty("qLabel")) {
								writeLine(visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabel);
								if( mode == 'write' ) {
									visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression = 
										gh.toTransString(visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabel);
								}
							} else {
								if( mode == 'undo' ) {
									visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabel = 
										gh.revertString(visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression);
									delete visprop.boxplotDef.qHyperCubeDef.qMeasures[j].qDef.qLabelExpression;
								}
							}
						}
					}
				}
							
				obj.setProperties(visprop)							
				.then(() => {
					console.log("Obj nr: " + numberOfMasterVis + ".");
					numberOfMasterVis = numberOfMasterVis - 1;
					if ( numberOfMasterVis == 0  ) {
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
				console.log("Skipping filterpane " + numberOfMasterVis);
				numberOfMasterVis = numberOfMasterVis - 1;			
			}
		})
	})
})
.catch(err => console.log('Something went wrong :(', err))
