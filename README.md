# qStrToExpr
A set of Enigma scripts for extracting and converting strings in Qlik Sense apps to translation expressions.

* Read: Extracts strings that can be converted to epxressions to CSV file
* Write: Converts strings to Qlik expressions `=$(Translate('Any string'))`
* Undo: Restores converted expressions back to strings

The main bat file runs all scripts and merges the csv files into one.

# Install
* Install [enigma.js](https://github.com/qlik-oss/enigma.js)
* Download zip file and extract to folder

# Run
* Start Qlik Sense Desktop
* Open command prompt
* Run bat file
```
Usage:   .\qStrToExpr.bat <read|write|undo> <appname>
Example: .\qStrToExpr.bat read LabelExtract
```
# Notes
* Tested on Qlik Sense April 2018
* Modifies the data structure of the app, might break in older or younger versions.
* Make a copy of the app before running the script

# Translating Sense apps
The script can be used as a starting point for producing a multi lingual Qlik Sense app. The example Sense app contains a link to a Google Spreadsheet that contains the string index and auto translated strings `=GoogleTranslate($A2,$A$1,B$1)` to a number of languages. More info on the subject on translating apps [Handling Multiple Languages](https://community.qlik.com/blogs/qlikviewdesignblog/2012/11/30/handling-multiple-languages) by Charles Bannon.
