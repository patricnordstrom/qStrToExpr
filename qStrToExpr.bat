if [%1]==[] goto usage

node .\getset.js -m=%1 -a %2.qvf
node .\getset_sheets.js -m=%1 -a %2.qvf
node .\getset_filterpanes.js -m=%1 -a %2.qvf
node .\getset_masteritems.js -m=%1 -a %2.qvf
node .\getset_masteritems_filterpanes.js -m=%1 -a %2.qvf
node .\getset_masteritems_dims.js -m=%1 -a %2.qvf
node .\getset_masteritems_meas.js -m=%1 -a %2.qvf

type %2.csv %2_shts.csv %2_fp.csv %2_ms.csv %2_ms_fp.csv %2_ms_dim.csv %2_ms_meas.csv > %2_all.csv

goto :eof

:usage

@echo Script for extracting and converting strings to expressions in Sense apps.
@echo Qlik Sense Desktop running is required.
@echo --
@echo Usage:   qStrToExpr read/write/undo appname
@echo Example: qStrToExpr write           LabelExtract
