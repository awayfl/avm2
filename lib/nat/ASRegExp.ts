import { transformJStoASRegExpMatchArray } from './transformJStoASRegExpMatchArray';
import { ASObject } from './ASObject';
import { addPrototypeFunctionAlias } from './addPrototypeFunctionAlias';
import { Errors } from '../errors';
import { ASArray } from './ASArray';
import { Settings } from '../Settings';
import { XRegExp } from './XRegLookup';
import { ExecArray } from 'xregexp/types';

const WARN_REPORT_TABLE: StringMap<boolean> = {};

const IS_SUPPORT_LOOKBEHIND = (() => {
	try {
		new RegExp('(?<=)');
		return true;
	} catch (_) {
		return false;
	}
})();

export class ASRegExp extends ASObject {
	private static UNMATCHABLE_PATTERN = '^(?!)$';

	static classInitializer() {
		const proto: any = this.dPrototype;
		const asProto: any = ASRegExp.prototype;
		addPrototypeFunctionAlias(proto, '$BgtoString', asProto.ecmaToString);
		addPrototypeFunctionAlias(proto, '$Bgexec', asProto.exec);
		addPrototypeFunctionAlias(proto, '$Bgtest', asProto.test);
	}

	public value: RegExp;

	private _flags: string = '';
	private _useFallback: boolean = false;
	private _dotall: boolean;
	private _extended: boolean;
	private _source: string;
	private _captureNames: string [];

	constructor(pattern: any, flags?: string) {
		super();
		this._dotall = false;
		this._extended = false;
		this._captureNames = [];

		let source: string;
		if (pattern === undefined) {
			pattern = source = '';
		} else if (this.sec.AXRegExp.axIsType(pattern)) {
			if (flags) {
				this.sec.throwError('TypeError', Errors.RegExpFlagsArgumentError);
			}

			flags = pattern._flags;
			source = pattern.source;
			pattern = pattern.value;
		} else {
			pattern = String(pattern);
			// Escape all forward slashes.
			source = pattern.replace(/(^|^[/]|(?:\\\\)+)\//g, '$1\\/');
			if (flags) {
				const f = flags;
				flags = '';
				for (let i = 0; i < f.length; i++) {
					const flag = f[i];
					switch (flag) {
						case 's':
							// With the s flag set, . will match the newline character.
							this._dotall = true;
							break;
						case 'x':
							// With the x flag set, spaces in the regular expression, will be ignored as part of
							// the pattern.
							this._extended = true;
							break;
						case 'g':
						case 'i':
						case 'm':
							// Only keep valid flags since an ECMAScript compatible RegExp implementation will
							// throw on invalid ones. We have to avoid that in ActionScript.
							flags += flag;
					}
				}
			}

			this._flags = flags;
			pattern = this._parse(source);
		}

		try {
			this.value = new RegExp(pattern, flags);
		} catch (e) {
			console.log('Unsupported RegExp pattern:' + pattern);
			this._useFallback = true;
		}

		this._source = source;
	}

	// Parses and sanitizes a AS3 RegExp pattern to be used in JavaScript. Silently fails and
	// returns an unmatchable pattern of the source turns out to be invalid.
	private _parse(pattern: string): string {

		if (pattern.includes('(?<=') || pattern.includes('(?<!') && !this._extended) {

			if (!IS_SUPPORT_LOOKBEHIND) {
				if (!Settings.EMULATE_LOOKBEHIND) {
					throw new Error(
						'[ASRegExp] Pattern include a lookbehind, but your browser not usupport it:' + pattern);
				}

				WARN_REPORT_TABLE['lookbehind'] || console.warn(
					'[ASRegExp] Pattern include a lookbehind, we should use XRegExp polyfill for Safari.\n', pattern);
				WARN_REPORT_TABLE['lookbehind'] = true;

				// falling down to XRegExp
				this._useFallback = true;
				return pattern;
			}

			WARN_REPORT_TABLE['lookbehind'] || console.warn(
				'[ASRegExp] Pattern include a lookbehind, we will use a native .\n', pattern);
			WARN_REPORT_TABLE['lookbehind'] = true;

			return pattern;
		}

		let result = '';
		const captureNames = this._captureNames;
		const parens = [];
		let atoms = 0;
		for (let i = 0; i < pattern.length; i++) {
			const char = pattern[i];
			switch (char) {
				case '(':
					result += char;
					parens.push(atoms > 1 ? atoms - 1 : atoms);
					atoms = 0;
					if (pattern[i + 1] === '?') {
						switch (pattern[i + 2]) {
							case ':':
							case '=':
							case '!':
								result += '?' + pattern[i + 2];
								i += 2;
								break;
							default:
								if (/\(\?P<([\w$]+)>/.exec(pattern.substr(i))) {
									const name = RegExp.$1;
									if (name !== 'length') {
										captureNames.push(name);
									}
									if (captureNames.indexOf(name) > -1) {
										// TODO: Handle the case were same name is used for multiple groups.
									}
									i += RegExp.lastMatch.length - 1;
								} else {
									return ASRegExp.UNMATCHABLE_PATTERN;
								}
						}
					} else {
						captureNames.push(null);
					}
					// 406 seems to be the maximum number of capturing groups allowed in a pattern.
					// Examined by testing.
					if (captureNames.length > 406) {
						return ASRegExp.UNMATCHABLE_PATTERN;
					}
					break;
				case ')':
					if (!parens.length) {
						return ASRegExp.UNMATCHABLE_PATTERN;
					}
					result += char;
					atoms = parens.pop() + 1;
					break;
				case '|':
					result += char;
					break;
				case '\\':
					result += char;
					if (/\\|c[A-Z]|x[0-9,a-z,A-Z]{2}|u[0-9,a-z,A-Z]{4}|./.exec(pattern.substr(i + 1))) {
						result += RegExp.lastMatch;
						i += RegExp.lastMatch.length;
					}
					if (atoms <= 1) {
						atoms++;
					}
					break;
				case '[':
					if (/\[[^\]]*\]/.exec(pattern.substr(i))) {
						result += RegExp.lastMatch;
						i += RegExp.lastMatch.length - 1;
						if (atoms <= 1) {
							atoms++;
						}
					} else {
						return ASRegExp.UNMATCHABLE_PATTERN;
					}
					break;
				case '{':
					if (/\{[^{]*?(?:,[^{]*?)?\}/.exec(pattern.substr(i))) {
						result += RegExp.lastMatch;
						i += RegExp.lastMatch.length - 1;
					} else {
						return ASRegExp.UNMATCHABLE_PATTERN;
					}
					break;
				case '.':
					if (this._dotall) {
						result += '[\\s\\S]';
					} else {
						result += char;
					}
					if (atoms <= 1) {
						atoms++;
					}
					break;
				case '?':
				case '*':
				case '+':
					if (!atoms) {
						return ASRegExp.UNMATCHABLE_PATTERN;
					}
					result += char;
					if (pattern[i + 1] === '?') {
						i++;
						result += '?';
					}
					break;
				case ' ':
				{
					if (this._extended) {
						break;
					}

					result += char;
					if (atoms <= 1) {
						atoms++;
					}
					break;
				}
				default: {
					result += char;
					if (atoms <= 1) {
						atoms++;
					}
				}
			}
			// 32767 seams to be the maximum allowed length for RegExps in SpiderMonkey.
			// Examined by testing.
			if (result.length > 0x7fff) {
				return ASRegExp.UNMATCHABLE_PATTERN;
			}
		}
		if (parens.length) {
			return ASRegExp.UNMATCHABLE_PATTERN;
		}
		return result;
	}

	ecmaToString(): string {
		let out = '/' + this._source + '/';
		if (this.value.global)     out += 'g';
		if (this.value.ignoreCase) out += 'i';
		if (this.value.multiline)  out += 'm';
		if (this._dotall)          out += 's';
		if (this._extended)        out += 'x';
		return out;
	}

	axCall(_: any): any {
		// eslint-disable-next-line
		return this.exec.apply(this, arguments);
	}

	axApply(_: any, argArray?: any[]): any {
		// eslint-disable-next-line
		return this.exec.apply(this, argArray);
	}

	get source(): string {
		return this._source;
	}

	get global(): boolean {
		return this.value.global;
	}

	get ignoreCase(): boolean {
		return this.value.ignoreCase;
	}

	get multiline(): boolean {
		return this.value.multiline;
	}

	get lastIndex(): number {
		return this.value.lastIndex;
	}

	set lastIndex(value: number) {
		this.value.lastIndex = value;
	}

	get dotall(): boolean {
		return this._dotall;
	}

	get extended(): boolean {
		return this._extended;
	}

	internalStringSearch (string: string): number {
		if (!this._useFallback) {
			return string.search(this.value);
		}

		return XRegExp.searchLb(string, this._source, this._flags);
	}

	internalStringReplace (string: string, replace: string | any): string {
		if (!this._useFallback) {
			return string.replace(this.value, replace);
		}

		return XRegExp.replaceLb(string, this._source, replace, this._flags);
	}

	// box string matche from string
	internalStringMatch (string: string): any {
		if (!this._useFallback) {
			return string.match(this.value);
		}

		const res = XRegExp.matchAllLb(string, this._source, this._flags);

		if (res.length > 0) {
			const match = <any>[res[0]];

			/**
			* XRegExp not fully implement lookup behind matching, set index to 0
			* @todo Maybe dangerous, implement it!
			*/
			match.index = 0;
			match.input = string;
			return match;
		}

		return null;
	}

	exec(str: string = ''): ASArray {
		let result: RegExpExecArray | ExecArray;

		if (this._useFallback) {
			result = XRegExp.execLb(str, this._source, this._flags);
		} else {
			result = this.value.exec(str);
		}

		if (!result) {
			return null;
		}
		const axResult = transformJStoASRegExpMatchArray(this.sec, result);
		const captureNames = this._captureNames;
		if (captureNames) {
			for (let i = 0; i < captureNames.length; i++) {
				const name = captureNames[i];
				if (name !== null) {
					// In AS3, non-matched named capturing groups return an empty string.
					const value = result[i + 1] || '';
					result[name] = value;
					axResult.axSetPublicProperty(name, value);
				}
			}
			return axResult;
		}
	}

	test(str: string = ''): boolean {
		return this.exec(str) !== null;
	}
}