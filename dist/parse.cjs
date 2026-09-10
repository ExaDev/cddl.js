Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_rolldown_runtime = require("./rolldown-runtime-VH7oDXx4.cjs");
let camelcase = require("camelcase");
camelcase = require_rolldown_runtime.__toESM(camelcase, 1);
let node_fs = require("node:fs");
node_fs = require_rolldown_runtime.__toESM(node_fs, 1);
//#region vendor/cddl/dist/tokens.js
var Tokens;
(function(Tokens) {
	Tokens["ILLEGAL"] = "ILLEGAL";
	Tokens["EOF"] = "EOF";
	Tokens["NL"] = "\n";
	Tokens["SPACE"] = " ";
	Tokens["UNDERSCORE"] = "_";
	Tokens["DOLLAR"] = "$";
	Tokens["ATSIGN"] = "@";
	Tokens["CARET"] = "^";
	Tokens["HASH"] = "#";
	Tokens["TILDE"] = "~";
	Tokens["IDENT"] = "IDENT";
	Tokens["INT"] = "INT";
	Tokens["COMMENT"] = "COMMENT";
	Tokens["STRING"] = "STRING";
	Tokens["NUMBER"] = "NUMBER";
	Tokens["FLOAT"] = "FLOAT";
	Tokens["ASSIGN"] = "=";
	Tokens["PLUS"] = "+";
	Tokens["MINUS"] = "-";
	Tokens["SLASH"] = "/";
	Tokens["QUEST"] = "?";
	Tokens["ASTERISK"] = "*";
	Tokens["COMMA"] = ",";
	Tokens["DOT"] = ".";
	Tokens["COLON"] = ":";
	Tokens["SEMICOLON"] = ";";
	Tokens["LPAREN"] = "(";
	Tokens["RPAREN"] = ")";
	Tokens["LBRACE"] = "{";
	Tokens["RBRACE"] = "}";
	Tokens["LBRACK"] = "[";
	Tokens["RBRACK"] = "]";
	Tokens["LT"] = "<";
	Tokens["GT"] = ">";
	Tokens["QUOT"] = "\"";
})(Tokens || (Tokens = {}));
//#endregion
//#region vendor/cddl/dist/utils.js
function isLetter(ch) {
	return "a" <= ch && ch <= "z" || "A" <= ch && ch <= "Z";
}
function isAlphabeticCharacter(ch) {
	return isLetter(ch) || ch === Tokens.ATSIGN || ch === Tokens.UNDERSCORE || ch === Tokens.DOLLAR;
}
function isDigit(ch) {
	return !isNaN(ch) && ch !== Tokens.NL && ch !== Tokens.SPACE;
}
function hasSpecialNumberCharacter(ch) {
	return ch === Tokens.MINUS.charCodeAt(0) || ch === Tokens.DOT.charCodeAt(0) || ch === "x".charCodeAt(0) || ch === "b".charCodeAt(0);
}
function parseNumberValue(token) {
	if (token.Type === Tokens.FLOAT) return parseFloat(token.Literal);
	if (token.Literal.includes("x") || token.Literal.includes("b")) return token.Literal;
	return parseInt(token.Literal, 10);
}
//#endregion
//#region vendor/cddl/dist/constants.js
const WHITESPACE_CHARACTERS = [
	" ",
	"	",
	"\n",
	"\r"
];
const BOOLEAN_LITERALS = ["true", "false"];
/**
* as defined in Appendix D
* https://tools.ietf.org/html/draft-ietf-cbor-cddl-08#appendix-D
*/
const PREDEFINED_IDENTIFIER = [
	"any",
	"uint",
	"nint",
	"int",
	"bstr",
	"bytes",
	"tstr",
	"text",
	"tdate",
	"time",
	"number",
	"biguint",
	"bignint",
	"bigint",
	"integer",
	"unsigned",
	"decfrac",
	"bigfloat",
	"eb64url",
	"eb64legacy",
	"eb16",
	"encoded-cbor",
	"uri",
	"b64url",
	"b64legacy",
	"regexp",
	"mime-message",
	"cbor-any",
	"float16",
	"float32",
	"float64",
	"float16-32",
	"float32-64",
	"float",
	"false",
	"true",
	"bool",
	"nil",
	"null",
	"undefined"
];
//#endregion
//#region vendor/cddl/dist/lexer.js
var Lexer = class {
	input;
	position = 0;
	readPosition = 0;
	ch = 0;
	constructor(source) {
		this.input = source;
		this.readChar();
	}
	readChar() {
		if (this.readPosition >= this.input.length) this.ch = 0;
		else this.ch = this.input[this.readPosition].charCodeAt(0);
		this.position = this.readPosition;
		this.readPosition++;
	}
	getLocation() {
		const position = this.position - 2;
		const sourceLineLength = this.input.split("\n").map((l) => l.length);
		let i = 0;
		for (const [line, lineLength] of Object.entries(sourceLineLength)) {
			i += lineLength + 1;
			if (i > position) {
				const lineBegin = i - lineLength;
				return {
					line: parseInt(line, 10),
					position: position - lineBegin + 1
				};
			}
		}
		return {
			line: 0,
			position: 0
		};
	}
	getLine(lineNumber) {
		return this.input.split("\n")[lineNumber];
	}
	getLocationInfo() {
		const loc = this.getLocation();
		let locationInfo = (loc ? this.getLine(loc.line) : "") + "\n";
		locationInfo += " ".repeat(loc?.position || 0) + "^\n";
		locationInfo += " ".repeat(loc?.position || 0) + "|\n";
		return locationInfo;
	}
	nextToken() {
		let token;
		this.skipWhitespace();
		const Literal = String.fromCharCode(this.ch);
		switch (this.ch) {
			case "=".charCodeAt(0):
				token = {
					Type: Tokens.ASSIGN,
					Literal
				};
				break;
			case "(".charCodeAt(0):
				token = {
					Type: Tokens.LPAREN,
					Literal
				};
				break;
			case ")".charCodeAt(0):
				token = {
					Type: Tokens.RPAREN,
					Literal
				};
				break;
			case "{".charCodeAt(0):
				token = {
					Type: Tokens.LBRACE,
					Literal
				};
				break;
			case "}".charCodeAt(0):
				token = {
					Type: Tokens.RBRACE,
					Literal
				};
				break;
			case "[".charCodeAt(0):
				token = {
					Type: Tokens.LBRACK,
					Literal
				};
				break;
			case "]".charCodeAt(0):
				token = {
					Type: Tokens.RBRACK,
					Literal
				};
				break;
			case "<".charCodeAt(0):
				token = {
					Type: Tokens.LT,
					Literal
				};
				break;
			case ">".charCodeAt(0):
				token = {
					Type: Tokens.GT,
					Literal
				};
				break;
			case "+".charCodeAt(0):
				token = {
					Type: Tokens.PLUS,
					Literal
				};
				break;
			case ",".charCodeAt(0):
				token = {
					Type: Tokens.COMMA,
					Literal
				};
				break;
			case ".".charCodeAt(0):
				token = {
					Type: Tokens.DOT,
					Literal
				};
				break;
			case ":".charCodeAt(0):
				token = {
					Type: Tokens.COLON,
					Literal
				};
				break;
			case "?".charCodeAt(0):
				token = {
					Type: Tokens.QUEST,
					Literal
				};
				break;
			case "/".charCodeAt(0):
				token = {
					Type: Tokens.SLASH,
					Literal
				};
				break;
			case "*".charCodeAt(0):
				token = {
					Type: Tokens.ASTERISK,
					Literal
				};
				break;
			case "^".charCodeAt(0):
				token = {
					Type: Tokens.CARET,
					Literal
				};
				break;
			case "#".charCodeAt(0):
				token = {
					Type: Tokens.HASH,
					Literal
				};
				break;
			case "~".charCodeAt(0):
				token = {
					Type: Tokens.TILDE,
					Literal
				};
				break;
			case "\"".charCodeAt(0):
				token = {
					Type: Tokens.STRING,
					Literal: this.readString()
				};
				break;
			case ";".charCodeAt(0):
				token = {
					Type: Tokens.COMMENT,
					Literal: this.readComment()
				};
				break;
			case 0:
				token = {
					Type: Tokens.EOF,
					Literal: ""
				};
				break;
			default:
				if (isAlphabeticCharacter(Literal)) return {
					Type: Tokens.IDENT,
					Literal: this.readIdentifier()
				};
				else if (isDigit(Literal) || this.ch === Tokens.MINUS.charCodeAt(0) && isDigit(this.input[this.readPosition])) {
					const numberOrFloat = this.readNumberOrFloat();
					return {
						Type: numberOrFloat.includes(Tokens.DOT) ? Tokens.FLOAT : Tokens.NUMBER,
						Literal: numberOrFloat
					};
				}
				token = {
					Type: Tokens.ILLEGAL,
					Literal: ""
				};
		}
		this.readChar();
		return token;
	}
	readIdentifier() {
		const position = this.position;
		/**
		* an identifier can contain
		* see https://tools.ietf.org/html/draft-ietf-cbor-cddl-08#section-3.1
		*/
		while (isLetter(String.fromCharCode(this.ch)) || isDigit(String.fromCharCode(this.ch)) || [
			Tokens.MINUS.charCodeAt(0),
			Tokens.UNDERSCORE.charCodeAt(0),
			Tokens.ATSIGN.charCodeAt(0),
			Tokens.DOT.charCodeAt(0),
			Tokens.DOLLAR.charCodeAt(0)
		].includes(this.ch)) this.readChar();
		return this.input.slice(position, this.position);
	}
	readComment() {
		const position = this.position;
		while (this.ch && String.fromCharCode(this.ch) !== "\n") this.readChar();
		return this.input.slice(position, this.position).trim();
	}
	readString() {
		const position = this.position;
		this.readChar();
		while (this.ch && String.fromCharCode(this.ch) !== Tokens.QUOT) this.readChar();
		return this.input.slice(position + 1, this.position).trim();
	}
	readNumberOrFloat() {
		const position = this.position;
		let foundSpecialCharacter = false;
		/**
		* a number of float can contain
		*/
		while (isDigit(String.fromCharCode(this.ch)) || hasSpecialNumberCharacter(this.ch)) {
			/**
			* ensure we respect ranges, e.g. 0..10
			* so break after the second dot and adjust read position
			*/
			if (hasSpecialNumberCharacter(this.ch) && foundSpecialCharacter) {
				this.position--;
				this.readPosition--;
				break;
			}
			foundSpecialCharacter = hasSpecialNumberCharacter(this.ch);
			this.readChar();
		}
		return this.input.slice(position, this.position).trim();
	}
	skipWhitespace() {
		while (WHITESPACE_CHARACTERS.includes(String.fromCharCode(this.ch))) this.readChar();
	}
};
//#endregion
//#region vendor/cddl/dist/ast.js
var Type;
(function(Type) {
	/**
	* any types
	*/
	Type["ANY"] = "any";
	/**
	* boolean types
	*/
	Type["BOOL"] = "bool";
	/**
	* numeric types
	*/
	Type["INT"] = "int";
	Type["UINT"] = "uint";
	Type["NINT"] = "nint";
	Type["FLOAT"] = "float";
	Type["FLOAT16"] = "float16";
	Type["FLOAT32"] = "float32";
	Type["FLOAT64"] = "float64";
	/**
	* string types
	*/
	Type["BSTR"] = "bstr";
	Type["BYTES"] = "bytes";
	Type["TSTR"] = "tstr";
	Type["TEXT"] = "text";
	/**
	* null types
	*/
	Type["NIL"] = "nil";
	Type["NULL"] = "null";
})(Type || (Type = {}));
//#endregion
//#region vendor/cddl/dist/parser.js
const NIL_TOKEN = {
	Type: Tokens.ILLEGAL,
	Literal: ""
};
const DEFAULT_OCCURRENCE = {
	n: 1,
	m: 1
};
const OPERATORS = [
	"default",
	"size",
	"regexp",
	"bits",
	"and",
	"within",
	"eq",
	"ne",
	"lt",
	"le",
	"gt",
	"ge",
	"cbor",
	"cborseq"
];
const OPERATORS_EXPECTING_VALUES = {
	default: void 0,
	size: ["literal", "range"],
	regexp: ["literal"],
	bits: ["group"],
	and: ["group"],
	within: ["group"],
	eq: ["group"],
	ne: ["group"],
	lt: ["group"],
	le: ["group"],
	gt: ["group"],
	ge: ["group"],
	cbor: ["group"],
	cborseq: ["group"]
};
var Parser = class {
	#filePath;
	l;
	curToken = NIL_TOKEN;
	peekToken = NIL_TOKEN;
	peekBelowToken = NIL_TOKEN;
	constructor(filePath) {
		this.#filePath = filePath;
		this.l = new Lexer(node_fs.default.readFileSync(filePath, "utf-8"));
		this.nextToken();
		this.nextToken();
		this.nextToken();
	}
	nextToken() {
		this.curToken = this.peekToken;
		this.peekToken = this.peekBelowToken;
		this.peekBelowToken = this.l.nextToken();
		return true;
	}
	parseAssignments() {
		const comments = [];
		while (this.curToken.Type === Tokens.COMMENT) {
			const comment = this.parseComment();
			if (comment) comments.push(comment);
		}
		/**
		* expect group identifier, e.g.
		* groupName =
		* groupName /=
		* groupName //=
		*/
		if (this.curToken.Type !== Tokens.IDENT || !(this.peekToken.Type === Tokens.ASSIGN || this.peekToken.Type === Tokens.SLASH)) throw this.parserError(`group identifier expected, received "${JSON.stringify(this.curToken)}"`);
		let isChoiceAddition = false;
		const groupName = this.curToken.Literal;
		this.nextToken();
		if (this.curToken.Type === Tokens.SLASH) {
			isChoiceAddition = true;
			this.nextToken();
		}
		if (this.curToken.Type === Tokens.SLASH) this.nextToken();
		this.nextToken();
		const assignmentValue = this.parseAssignmentValue(groupName, isChoiceAddition);
		while (this.curToken.Type === Tokens.COMMENT) {
			const comment = this.parseComment();
			comment && comments.push(comment);
		}
		assignmentValue.Comments = comments;
		return assignmentValue;
	}
	parseAssignmentValue(groupName, isChoiceAddition = false) {
		let isChoice = false;
		const valuesOrProperties = [];
		const closingTokens = this.openSegment();
		/**
		* if no group segment was opened we have a variable assignment
		* and can return immediatelly, e.g.
		*
		*   attire = "bow tie" / "necktie" / "Internet attire"
		*
		*/
		if (closingTokens.length === 0) {
			if (groupName) return {
				Type: "variable",
				Name: groupName,
				IsChoiceAddition: isChoiceAddition,
				PropertyType: this.parsePropertyTypes(true),
				Comments: []
			};
			return this.parsePropertyTypes();
		}
		/**
		* type or group choices can be wrapped within `(` and `)`, e.g.
		*
		*   attireBlock = (
		*       "bow tie" /
		*       "necktie" /
		*       "Internet attire"
		*   )
		*   attireGroup = (
		*       attire //
		*       attireBlock
		*   )
		*/
		if (closingTokens.includes(Tokens.RPAREN) && this.peekToken.Type === Tokens.SLASH && this.peekBelowToken.Type !== Tokens.SLASH && !(this.curToken.Type === Tokens.SLASH && this.peekToken.Type === Tokens.SLASH)) {
			const propertyType = [];
			while (!closingTokens.includes(this.curToken.Type)) {
				propertyType.push(...this.parsePropertyTypes(true));
				if (closingTokens.includes(this.curToken.Type)) {
					this.nextToken();
					break;
				}
				this.nextToken();
				if (this.curToken.Type === Tokens.SLASH) this.nextToken();
			}
			if (this.curToken.Type === Tokens.RPAREN) this.nextToken();
			if (groupName) {
				const variable = {
					Type: "variable",
					Name: groupName,
					IsChoiceAddition: isChoiceAddition,
					PropertyType: propertyType,
					Comments: []
				};
				if (this.isOperator()) variable.Operator = this.parseOperator();
				return variable;
			}
			return propertyType;
		}
		/**
		* parse operator assignments, e.g. `ip4 = (float .ge 0.0) .default 1.0`
		*/
		if (closingTokens.length === 1 && this.peekToken.Type === Tokens.DOT) {
			const propertyType = this.parsePropertyType();
			const operator = this.isOperator() ? this.parseOperator() : void 0;
			const prop = {
				Type: propertyType,
				...operator ? { Operator: operator } : {}
			};
			/**
			* this branch exists for the single-element case, e.g. `ip4 = (float .ge 0.0)`, where the operator's value is immediately followed by the closing token. If a comma follows instead, e.g. `[ bstr .size 3, bstr ]`, there are more elements still to come -- seed the general array/group loop below with this first element rather than assuming we are already done.
			*/
			if (this.curToken.Type === Tokens.COMMA) {
				valuesOrProperties.push({
					HasCut: false,
					Occurrence: DEFAULT_OCCURRENCE,
					Name: "",
					Type: [prop],
					Comments: []
				});
				this.nextToken();
			} else {
				this.nextToken();
				if (groupName) {
					const trailingOperator = this.isOperator() ? this.parseOperator() : void 0;
					return {
						Type: "variable",
						Name: groupName,
						IsChoiceAddition: isChoiceAddition,
						PropertyType: prop,
						...trailingOperator ? { Operator: trailingOperator } : {},
						Comments: []
					};
				}
				return [prop];
			}
		}
		while (!closingTokens.includes(this.curToken.Type)) {
			const comments = [];
			let leadingComment = this.parseComment(true);
			while (leadingComment) {
				comments.push(leadingComment);
				leadingComment = this.parseComment(true);
			}
			/**
			* check if we have a group choice instead of an assignment
			*/
			if (this.curToken.Type === Tokens.SLASH && this.peekToken.Type === Tokens.SLASH) {
				if (valuesOrProperties.length === 0) throw this.parserError("Unexpected group choice operator \"//\" at start of group");
				if (!isChoice) {
					const last = valuesOrProperties.pop();
					valuesOrProperties.push([last]);
					isChoice = true;
				}
				this.nextToken();
				this.nextToken();
				continue;
			}
			const propertyType = [];
			let isUnwrapped = false;
			let hasCut = false;
			let propertyName = "";
			const occurrence = this.parseOccurrences();
			/**
			* check if variable name is unwrapped
			*/
			if (this.curToken.Literal === Tokens.TILDE) {
				isUnwrapped = true;
				this.nextToken();
			}
			/**
			* parse assignment within array, e.g.
			* ```
			* ActionsPerformActionsParameters = [1* {
			*   type: "key",
			*   id: text,
			*   actions: ActionItems,
			*   *text => any
			* }]
			* ```
			* or
			* ```
			* script.MappingRemoteValue = [*[(script.RemoteValue / text), script.RemoteValue]];
			* ```
			*/
			if (this.curToken.Literal === Tokens.LBRACE || this.curToken.Literal === Tokens.LBRACK || this.curToken.Literal === Tokens.LPAREN) {
				const prop = {
					HasCut: false,
					Occurrence: occurrence,
					Name: "",
					Type: this.parseAssignmentValue(),
					Comments: []
				};
				if (isChoice) valuesOrProperties[valuesOrProperties.length - 1].push(prop);
				else valuesOrProperties.push(prop);
				if (this.curToken.Type === Tokens.COMMA) {
					this.nextToken();
					isChoice = false;
				}
				if (this.curToken.Type === Tokens.SLASH && this.peekToken.Type !== Tokens.SLASH) {
					if (!isChoice) {
						const last = valuesOrProperties.pop();
						valuesOrProperties.push([last]);
						isChoice = true;
					}
					this.nextToken();
				}
				continue;
			}
			/**
			* check if we are in an array and a new item is indicated
			*/
			if (this.curToken.Literal === Tokens.COMMA && closingTokens[0] === Tokens.RBRACK) {
				this.nextToken();
				continue;
			}
			propertyName = this.parsePropertyName();
			/**
			* an unnamed member decorated with an operator, e.g. `[ bstr .size 3, bstr ]` -- there is no colon here, so this must be handled before the colon-expecting path below ever sees it
			*/
			if (this.isOperator()) {
				const operator = this.parseOperator();
				const baseType = PREDEFINED_IDENTIFIER.includes(propertyName) ? { Type: propertyName } : {
					Type: "group",
					Value: propertyName,
					Unwrapped: isUnwrapped
				};
				valuesOrProperties.push({
					HasCut: hasCut,
					Occurrence: occurrence,
					Name: "",
					Type: [{
						...baseType,
						Operator: operator
					}],
					Comments: []
				});
				if (this.curToken.Type === Tokens.COMMA) this.nextToken();
				continue;
			}
			/**
			* if `,` is found we have a group reference and jump to the next line
			*/
			if (this.curToken.Type === Tokens.COMMA || closingTokens.includes(this.curToken.Type)) {
				const tokenType = this.curToken.Type;
				let parsedComments = false;
				let comment;
				/**
				* check if line has a comment
				*/
				if (this.curToken.Type === Tokens.COMMA && this.peekToken.Type === Tokens.COMMENT) {
					this.nextToken();
					comment = this.parseComment();
					parsedComments = true;
				}
				valuesOrProperties.push({
					HasCut: hasCut,
					Occurrence: occurrence,
					Name: "",
					Type: PREDEFINED_IDENTIFIER.includes(propertyName) ? propertyName : [{
						Type: "group",
						Value: propertyName,
						Unwrapped: isUnwrapped
					}],
					Comments: comment ? [comment] : []
				});
				if (this.curToken.Literal === Tokens.COMMA || this.curToken.Literal === closingTokens[0]) {
					if (this.curToken.Literal === Tokens.COMMA) this.nextToken();
					continue;
				}
				if (!parsedComments) this.nextToken();
				/**
				* only continue if next token contains a comma
				*/
				if (tokenType === Tokens.COMMA) continue;
				/**
				* otherwise break
				*/
				break;
			}
			/**
			* check if property has cut, which happens if a property is described as
			* - `? "optional-key" ^ => int,`
			* - `? optional-key: int,` - since the colon shortcut includes cuts
			*/
			if (this.curToken.Type === Tokens.CARET || this.curToken.Type === Tokens.COLON) {
				hasCut = true;
				if (this.curToken.Type === Tokens.CARET) this.nextToken();
			}
			/**
			* check if we have a group choice instead of an assignment
			*/
			if (this.curToken.Type === Tokens.SLASH && this.peekToken.Type === Tokens.SLASH) {
				const prop = {
					HasCut: hasCut,
					Occurrence: occurrence,
					Name: "",
					Type: {
						Type: "group",
						Value: propertyName,
						Unwrapped: isUnwrapped
					},
					Comments: comments
				};
				if (isChoice)
 /**
				* if we already in a choice just push into it
				*/
				valuesOrProperties[valuesOrProperties.length - 1].push(prop);
				else {
					/**
					* otherwise create a new one
					*/
					isChoice = true;
					valuesOrProperties.push([prop]);
				}
				this.nextToken();
				this.nextToken();
				continue;
			}
			/**
			* else if no colon was found, throw
			*/
			if (!this.isPropertyValueSeparator()) throw this.parserError("Expected \":\" or \"=>\"");
			this.nextToken();
			/**
			* parse property value
			*/
			const props = this.parseAssignmentValue();
			let operator = this.isOperator() ? this.parseOperator() : void 0;
			if (!isChoice && this.curToken.Type === Tokens.SLASH && this.peekToken.Type !== Tokens.SLASH) {
				this.nextToken();
				const nextType = this.parsePropertyType();
				if (Array.isArray(props)) {
					/**
					* property has not yet been flagged as a choice, but is part
					* of one, e.g. `(float .ge 1.0) / null`
					*/
					props.push(nextType);
					if (!this.isOperator()) this.nextToken();
				}
			}
			if (this.isOperator()) operator = this.parseOperator();
			if (Array.isArray(props))
 /**
			* property has multiple types (e.g. `float / tstr / int`)
			*/
			propertyType.push(...props);
			else propertyType.push(props);
			/**
			* advance comma
			*/
			let flipIsChoice = false;
			if (this.curToken.Type === Tokens.COMMA) {
				/**
				* if we are in a choice, we leave it here
				*/
				flipIsChoice = true;
				this.nextToken();
			}
			const trailingComment = this.parseComment();
			trailingComment && comments.push(trailingComment);
			const prop = {
				HasCut: hasCut,
				Occurrence: occurrence,
				Name: propertyName,
				Type: propertyType,
				Comments: comments,
				...operator ? { Operator: operator } : {}
			};
			if (isChoice) valuesOrProperties[valuesOrProperties.length - 1].push(prop);
			else valuesOrProperties.push(prop);
			if (flipIsChoice) isChoice = false;
			/**
			* if `}` is found we are at the end of the group
			*/
			if (closingTokens.includes(this.curToken.Type)) {
				/**
				* Handle the case where a group is followed by an inclusion operator, e.g.
				*
				* group1 = {
				*   name: tstr,
				*   age: number,
				* }
				*
				* group2 = {
				*   handle: tstr
				* } .and group1
				*
				*/
				while (this.peekToken.Type === Tokens.DOT) {
					this.nextToken();
					if (this.isOperator()) valuesOrProperties.push({
						Name: "",
						Type: "group",
						Occurrence: DEFAULT_OCCURRENCE,
						Operator: this.parseOperator(),
						Comments: [],
						HasCut: false
					});
				}
				break;
			}
			/**
			* eat // if we are in a choice
			*/
			if (isChoice) {
				this.nextToken();
				this.nextToken();
				continue;
			}
		}
		/**
		* close segment
		*/
		if (this.curToken.Type === [...closingTokens].shift()) this.nextToken();
		/**
		* if last closing token is "]" we have an array
		*/
		if (closingTokens[closingTokens.length - 1] === Tokens.RBRACK) return {
			Type: "array",
			Name: groupName || "",
			Values: valuesOrProperties,
			Comments: []
		};
		/**
		* simplify wrapped types, e.g. from
		* {
		*     "Type": "group",
		*     "Name": "",
		*     "Properties": [
		*         {
		*             "HasCut": false,
		*             "Occurrence": {
		*                 "n": 1,
		*                 "m": 1
		*             },
		*             "Name": "",
		*             "Type": "bool",
		*             "Comment": ""
		*         }
		*     ],
		*     "IsChoiceAddition": false
		* }
		* back to:
		* bool
		*/
		if (!groupName && valuesOrProperties.length === 1 && PREDEFINED_IDENTIFIER.includes(valuesOrProperties[0].Type)) return valuesOrProperties[0].Type;
		/**
		* otherwise a group
		*/
		return {
			Type: "group",
			Name: groupName || "",
			Properties: valuesOrProperties,
			IsChoiceAddition: isChoiceAddition,
			Comments: []
		};
	}
	isPropertyValueSeparator() {
		if (this.curToken.Type === Tokens.COLON) return true;
		if (this.curToken.Type === Tokens.ASSIGN && this.peekToken.Type === Tokens.GT) {
			this.nextToken();
			return true;
		}
		return false;
	}
	/**
	* checks if group segment is opened and forwards to beginning of
	* first property declaration
	* @returns {String[]}  closing tokens for group (either `}`, `)` or both)
	*/
	openSegment() {
		if (this.curToken.Type === Tokens.LBRACE) {
			this.nextToken();
			return [Tokens.RBRACE];
		} else if (this.curToken.Type === Tokens.LPAREN) {
			this.nextToken();
			return [Tokens.RPAREN];
		} else if (this.curToken.Type === Tokens.LBRACK) {
			this.nextToken();
			return [Tokens.RBRACK];
		}
		return [];
	}
	parsePropertyName() {
		/**
		* property name without quotes
		*/
		if (this.curToken.Type === Tokens.IDENT || this.curToken.Type === Tokens.STRING) {
			const name = this.curToken.Literal;
			this.nextToken();
			return name;
		}
		throw this.parserError(`Expected property name, received ${this.curToken.Type}(${this.curToken.Literal}), ${this.peekToken.Type}(${this.peekToken.Literal})`);
	}
	parsePropertyType() {
		let type = void 0;
		let isUnwrapped = false;
		let isGroupedRange = false;
		/**
		* check if variable name is unwrapped
		*/
		if (this.curToken.Literal === Tokens.TILDE) {
			isUnwrapped = true;
			this.nextToken();
		}
		/**
		* a quoted string is always a literal, even if its text matches a
		* reserved keyword like "null" or "bool"
		*/
		switch (this.curToken.Type === Tokens.STRING ? Tokens.STRING : this.curToken.Literal) {
			case Type.ANY:
			case Type.BOOL:
			case Type.INT:
			case Type.UINT:
			case Type.NINT:
			case Type.FLOAT:
			case Type.FLOAT16:
			case Type.FLOAT32:
			case Type.FLOAT64:
			case Type.BSTR:
			case Type.BYTES:
			case Type.TSTR:
			case Type.TEXT:
			case Type.NIL:
			case Type.NULL:
				type = this.curToken.Literal;
				break;
			default: if (this.curToken.Type === Tokens.STRING) type = {
				Type: "literal",
				Value: this.curToken.Literal,
				Unwrapped: isUnwrapped
			};
			else if (BOOLEAN_LITERALS.includes(this.curToken.Literal)) type = {
				Type: "literal",
				Value: this.curToken.Literal === "true",
				Unwrapped: isUnwrapped
			};
			else if (this.curToken.Literal === Tokens.LBRACE || this.curToken.Literal === Tokens.LBRACK) {
				const val = this.parseAssignmentValue();
				if (Array.isArray(val)) throw new Error("Unexpected array in property type parsing");
				type = val;
			} else if (this.curToken.Type === Tokens.IDENT) type = {
				Type: "group",
				Value: this.curToken.Literal,
				Unwrapped: isUnwrapped
			};
			else if (this.curToken.Type === Tokens.NUMBER || this.curToken.Type === Tokens.FLOAT) type = {
				Type: "literal",
				Value: parseNumberValue(this.curToken),
				Unwrapped: isUnwrapped,
				...this.curToken.Type === Tokens.FLOAT ? { IsFloat: true } : {}
			};
			else if (this.curToken.Type === Tokens.HASH) {
				this.nextToken();
				const n = parseNumberValue(this.curToken);
				this.nextToken();
				this.nextToken();
				const t = this.parsePropertyType();
				this.nextToken();
				type = {
					Type: "tag",
					Value: {
						NumericPart: n,
						TypePart: t
					},
					Unwrapped: isUnwrapped
				};
			} else if (this.curToken.Literal === Tokens.LPAREN && this.peekToken.Type === Tokens.NUMBER) {
				this.nextToken();
				type = {
					Type: "literal",
					Value: parseNumberValue(this.curToken),
					Unwrapped: isUnwrapped
				};
				isGroupedRange = true;
			} else throw this.parserError(`Invalid property type "${this.curToken.Literal}"`);
		}
		/**
		* check if type continue as a range
		*/
		if (this.peekToken.Type === Tokens.DOT && this.nextToken() && this.peekToken.Type === Tokens.DOT) {
			this.nextToken();
			let Inclusive = true;
			/**
			* check if range excludes upper bound
			*/
			if (this.peekToken.Type === Tokens.DOT) {
				Inclusive = false;
				this.nextToken();
			}
			this.nextToken();
			if (!type || typeof type === "object" && !("Value" in type)) throw new Error("Invalid type for range definition");
			const Min = typeof type === "string" || typeof type.Value === "number" ? type : type.Value;
			type = {
				Type: "range",
				Value: {
					Inclusive,
					Min,
					Max: this.parsePropertyType()
				},
				Unwrapped: isUnwrapped
			};
			if (!isGroupedRange && this.peekToken.Literal === Tokens.RPAREN) {
				/**
				* If we are at the end of a grouped range, and this was called
				* on the first item of the range as opposed to the opening
				* parenthesis, isGroupedRange will not be set to true at this
				* point. We need to advance to the closing parenthesis, and if
				* the next token is an operator, we need to advance to the dot
				* so that parseOperator will work properly.
				* e.g.
				*
				* ```
				* (1.0..2.0) .default 1.5
				* ```
				*
				* This will be called on the `1.0` and then the `2.0` will be parsed
				* as a grouped range.
				*/
				this.nextToken();
				if (this.isOperator()) isGroupedRange = true;
			}
			if (isGroupedRange) this.nextToken();
		}
		if (!type) {
			const { line, position: column } = this.l.getLocation();
			throw new Error(`Unexpected type: ${this.curToken.Type} at line ${line} column ${column}`);
		}
		return type;
	}
	parseOperator() {
		const type = this.peekToken.Literal;
		if (this.curToken.Literal !== Tokens.DOT || !OPERATORS.includes(this.peekToken.Literal)) throw new Error(`Operator ".${type}", expects a ${OPERATORS_EXPECTING_VALUES[type].join(" or ")} property, but found ${this.peekToken.Literal}!`);
		this.nextToken();
		this.nextToken();
		const value = this.parsePropertyType();
		this.nextToken();
		return {
			Type: type,
			Value: value
		};
	}
	isOperator() {
		return this.curToken.Literal === Tokens.DOT && OPERATORS.includes(this.peekToken.Literal);
	}
	parsePropertyTypes(attachChoiceOperators = false) {
		const propertyTypes = [];
		let prop = this.parsePropertyType();
		if (this.isOperator()) prop = {
			Type: prop,
			Operator: this.parseOperator()
		};
		else if (this.curToken.Type !== Tokens.SLASH) this.nextToken();
		propertyTypes.push(prop);
		/**
		* ignore comments between type choice members, e.g.
		* ```
		* Foo = int ; comment
		*     / text
		* ```
		* or
		* ```
		* Foo = int / ; comment
		*     text
		* ```
		*/
		while (this.curToken.Type === Tokens.COMMENT && this.peekToken.Type === Tokens.SLASH) this.parseComment();
		/**
		* ensure we don't go into the next choice, e.g.:
		* ```
		* delivery = (
		*   city // lala: tstr / bool // per-pickup: true,
		* )
		*/
		if (this.curToken.Type === Tokens.SLASH && this.peekToken.Type === Tokens.SLASH) return propertyTypes;
		/**
		* capture more if available (e.g. `tstr / float / boolean`)
		*/
		while (this.curToken.Type === Tokens.SLASH) {
			this.nextToken();
			while ([Tokens.COMMENT].includes(this.curToken.Type)) this.parseComment();
			let nextProp = this.parsePropertyType();
			if (this.isOperator()) {
				if (attachChoiceOperators) nextProp = {
					Type: nextProp,
					Operator: this.parseOperator()
				};
			} else if (this.curToken.Type !== Tokens.SLASH)
 /**
			* If we are not parsing an operator, we need to eat the next token;
			* otherwise, the operator will be parsed by the caller
			*/
			this.nextToken();
			propertyTypes.push(nextProp);
			while ([Tokens.COMMENT].includes(this.curToken.Type) && this.peekToken.Type === Tokens.SLASH) this.parseComment();
			/**
			* ensure we don't go into the next choice, e.g.:
			* ```
			* delivery = (
			*   city // lala: tstr / bool // per-pickup: true,
			* )
			*/
			if (this.curToken.Type === Tokens.SLASH && this.peekToken.Type === Tokens.SLASH) break;
		}
		return propertyTypes;
	}
	parseOccurrences() {
		let occurrence = DEFAULT_OCCURRENCE;
		/**
		* check for non-numbered occurrence indicator, e.g. zero or more:
		* ```
		*  * bedroom: size,
		* ```
		* zero or one:
		* ```
		*  ? bedroom: size,
		* ```
		* or one or more:
		* ```
		*  + bedroom: size,
		* ```
		*/
		if (this.curToken.Type === Tokens.QUEST || this.curToken.Type === Tokens.ASTERISK || this.curToken.Type === Tokens.PLUS) {
			const n = this.curToken.Type === Tokens.PLUS ? 1 : 0;
			let m = this.curToken.Type === Tokens.QUEST ? 1 : Infinity;
			/**
			* check if there is a max definition
			*/
			if (this.peekToken.Type === Tokens.NUMBER) {
				m = parseInt(this.peekToken.Literal, 10);
				this.nextToken();
			}
			occurrence = {
				n,
				m
			};
			this.nextToken();
		} else if (this.curToken.Type === Tokens.NUMBER && this.peekToken.Type === Tokens.ASTERISK) {
			const n = parseInt(this.curToken.Literal, 10);
			let m = Infinity;
			this.nextToken();
			this.nextToken();
			/**
			* check if there is a max definition
			*/
			if (this.curToken.Type === Tokens.NUMBER) {
				m = parseInt(this.curToken.Literal, 10);
				this.nextToken();
			}
			occurrence = {
				n,
				m
			};
		}
		return occurrence;
	}
	/**
	* check if line has a comment
	*/
	parseComment(isLeading) {
		if (this.curToken.Type !== Tokens.COMMENT) return;
		const comment = this.curToken.Literal.replace(/^;(\s*)/, "");
		this.nextToken();
		if (comment.trim().length === 0) return;
		return {
			Type: "comment",
			Content: comment,
			Leading: Boolean(isLeading)
		};
	}
	parse() {
		const definition = [];
		while (this.curToken.Type !== Tokens.EOF) {
			const group = this.parseAssignments();
			if (group) definition.push(group);
		}
		return definition;
	}
	parserError(message) {
		const location = this.l.getLocation();
		const locInfo = this.l.getLocationInfo();
		return /* @__PURE__ */ new Error(`${this.#filePath.replace(process.cwd(), "")}:${location.line + 1}:${location.position} - error: ${message}\n\n${locInfo}`);
	}
};
//#endregion
//#region vendor/cddl/dist/index.js
function parse$1(filePath) {
	return new Parser(filePath).parse();
}
//#endregion
//#region src/parse.ts
function parse(filePath) {
	return parse$1(filePath);
}
//#endregion
exports.parse = parse;
