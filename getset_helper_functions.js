module.exports = {

	// Helper functions for converting string to Sense expression
	isString: function (value) {return typeof value === 'string';},
	toTransString: function (string) { return "=$(Translate('" + string + "'))"; },
	revertString: function (string) { return string.replace("=$(Translate('","").replace("'))",""); },
	isTransString: function (string) { return string.includes("$(Translate('"); },
	strToExpr: function (string) { return { qStringExpression: { qExpr : module.exports.toTransString(string) }}; },
	convStrToExpr: function (string, mode) {
				
		if ( string == "" ) {
			return string;
		}
		switch(mode) {
			case 'write' :	
				if (module.exports.isString(string) ) {
					return { qStringExpression: { qExpr : module.exports.toTransString(string) }};
				} else { return string;	}
			case 'read' :
				return string;
			case 'undo' :
				if (! module.exports.isString(string) && (typeof string != 'undefined' ) ) {
					return module.exports.revertString(string.qStringExpression.qExpr);
				} else { return string;	}
			default:
				return string;
		}
	}
}