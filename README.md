# qStrToExpr
A set of Enigma scripts for extracting and converting strings in Qlik Sense apps to translation expressions.

* Read: Extracts strings that can be converted to epxressions to CSV file
* Write: Converts strings to Qlik expressions `=$(Translate('Any string'))`
* Undo: Restores converted expressions back to strings

The main bat file runs all scripts and merges the csv files into one.

## Install
* Install [enigma.js](https://github.com/qlik-oss/enigma.js)
* Install minimist `npm -i minimist`
* Download zip file and extract to folder

## Run
* Start Qlik Sense Desktop
* Open command prompt
* Run bat file
```
Usage:   .\qStrToExpr.bat <read|write|undo> <appname>
Example: .\qStrToExpr.bat read LabelExtract
```
The scripts can alo run individually:
```
Usage:   node getset_masteritems_filterpanes.js -m=read/write/undo -a appname
Example: node getset_masteritems_filterpanes.js -m=read -a LabelExtract
```
## Notes
* Tested on Qlik Sense April 2018.
* Modifies the data structure of the app, might break in older or younger versions.
* Make a copy of the app before running the script.
* Only strings that can be expressions in the UI is handled.
* LabelExtract.qvf is a example app with strings, LabelExtract_expr.qvf is the same app after conversion with strings as expressions.

## Strings
* Sheet: title and description
* Object: title, subtitle, footnote, dimension label, alternative dimension label, measure label, alternative measure label, chart totals.
* Object include barchart, boxplot, combo chart, distribution plot, filter pane, gauge, histogram, KPI, line chart, map chart, pie chart, pivot table, scatter plot, table, text box, treemap, waterfall and extensions.
* Masteritems, same as objects plus master item label and description.

## Translating Sense apps
The script can be used as a starting point for producing a multi lingual Qlik Sense app. The example Sense app contains a link to a Google Spreadsheet that contains the string index and auto translated strings `=GoogleTranslate($A2,$A$1,B$1)` to a number of languages. More info on the subject on translating apps [Handling Multiple Languages](https://community.qlik.com/blogs/qlikviewdesignblog/2012/11/30/handling-multiple-languages) by Charles Bannon.
