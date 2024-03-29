import { ASObject } from './ASObject';
import { addPrototypeFunctionAlias } from './addPrototypeFunctionAlias';
import { assert } from '@awayjs/graphics';
import { release } from '@awayfl/swf-loader';
import { Errors } from '../errors';
import { axCoerceString } from '../run/axCoerceString';
import { transformJStoASRegExpMatchArray } from './transformJStoASRegExpMatchArray';
import { as3Compatibility } from './as3Compatibility';
import { as3ToLowerCase } from './as3ToLowerCase';
import { ASRegExp } from './ASRegExp';
import { ASFunction } from './ASFunction';

export class ASString extends ASObject {
	static classNatives: any [] = [String];

	static classInitializer() {
		const proto: any = this.dPrototype;
		const asProto: any = ASString.prototype;
		addPrototypeFunctionAlias(proto, '$BgindexOf', asProto.generic_indexOf);
		addPrototypeFunctionAlias(proto, '$BglastIndexOf', asProto.generic_lastIndexOf);
		addPrototypeFunctionAlias(proto, '$BgcharAt', asProto.generic_charAt);
		addPrototypeFunctionAlias(proto, '$BgcharCodeAt', asProto.generic_charCodeAt);
		addPrototypeFunctionAlias(proto, '$Bgconcat', asProto.generic_concat);
		addPrototypeFunctionAlias(proto, '$BglocaleCompare', asProto.generic_localeCompare);
		addPrototypeFunctionAlias(proto, '$Bgmatch', asProto.generic_match);
		addPrototypeFunctionAlias(proto, '$Bgreplace', asProto.generic_replace);
		addPrototypeFunctionAlias(proto, '$Bgsearch', asProto.generic_search);
		addPrototypeFunctionAlias(proto, '$Bgslice', asProto.generic_slice);
		addPrototypeFunctionAlias(proto, '$Bgsplit', asProto.generic_split);
		addPrototypeFunctionAlias(proto, '$Bgsubstring', asProto.generic_substring);
		addPrototypeFunctionAlias(proto, '$Bgsubstr', asProto.generic_substr);
		addPrototypeFunctionAlias(proto, '$BgtoLowerCase', asProto.generic_toLowerCase);
		addPrototypeFunctionAlias(proto, '$BgtoLocaleLowerCase', asProto.generic_toLowerCase);
		addPrototypeFunctionAlias(proto, '$BgtoUpperCase', asProto.generic_toUpperCase);
		addPrototypeFunctionAlias(proto, '$BgtoLocaleUpperCase', asProto.generic_toUpperCase);
		addPrototypeFunctionAlias(proto, '$BgtoString', asProto.toString);
		addPrototypeFunctionAlias(proto, '$BgtoString', asProto.public_toString);
		addPrototypeFunctionAlias(proto, '$BgvalueOf', asProto.public_valueOf);

		addPrototypeFunctionAlias(<any> this, '$BgfromCharCode', ASString.fromCharCode);
	}

	private value: string;

	constructor(value: string) {
		super();
		this.value = value;
	}

	static fromCharCode(...charcodes: any []) {
		return String.fromCharCode.apply(null, charcodes);
	}

	indexOf(char: string, i?: number) {
		return this.value.indexOf(char, i);
	}

	lastIndexOf(char: string, i?: number) {
		return this.value.lastIndexOf(char, i);
	}

	charAt(index: number) {
		return this.value.charAt(index);
	}

	charCodeAt(index: number) {
		return this.value.charCodeAt(index);
	}

	concat() {
		// eslint-disable-next-line prefer-spread, prefer-rest-params
		return this.value.concat.apply(this.value, arguments);
	}

	localeCompare(other: string) {
		if (arguments.length > 1) {
			this.sec.throwError('ArgumentError', Errors.WrongArgumentCountError,
				'Function/<anonymous>()', 0, 2);
		}
		const value = this.value;
		release || assert(typeof this.value === 'string');
		other = String(other);
		if (other === value) {
			return 0;
		}
		const len = Math.min(value.length, other.length);
		for (let j = 0; j < len; j++) {
			if (value[j] !== other[j]) {
				return value.charCodeAt(j) - other.charCodeAt(j);
			}
		}
		return value.length > other.length ? 1 : -1;
	}

	__getRegExp(pattern: string | ASRegExp): ASRegExp {
		if (this.sec.AXRegExp.axIsType(pattern)) {
			return <ASRegExp>pattern;
		} else {
			return <any> this.sec.AXRegExp.axConstruct([axCoerceString(pattern)]);
		}
	}

	match(pattern: string | ASRegExp): any {

		const regExp = this.__getRegExp(pattern);
		const result =  regExp.internalStringMatch(this.value);

		if (!result) {
			return null;
		}

		try {
			return transformJStoASRegExpMatchArray(this.sec, result);
		} catch (e) {
			return null;
		}
	}

	replace(pattern: string | ASRegExp, repl: string | ASFunction) {
		if (this.sec.AXFunction.axIsType(repl)) {
			repl = (<any>repl).value;
		}

		try {
			if (!this.sec.AXRegExp.axIsType(pattern)) {
				pattern = axCoerceString(pattern);
				return this.value.replace(pattern, <any> repl);
			}

			return this.__getRegExp(pattern).internalStringReplace(this.value, repl);
		} catch (e) {
			return this.value;
		}
	}

	search(pattern: string | ASRegExp): number {
		try {
			if (!this.sec.AXRegExp.axIsType(pattern)) {
				return this.value.search(axCoerceString(pattern));
			}

			return this.__getRegExp(pattern).internalStringSearch(this.value);
		} catch (e) {
			return -1;
		}
	}

	slice(start?: number, end?: number) {
		start = arguments.length < 1 ? 0 : start | 0;
		end = arguments.length < 2 ? 0xffffffff : end | 0;
		return this.value.slice(start, end);
	}

	split(separator /* : string | ASRegExp */, limit?: number) {
		if (this.sec.AXRegExp.axIsType(separator)) {
			separator = (<any>separator).value;
		} else {
			separator = axCoerceString(separator);
		}
		limit = limit === undefined ? -1 : limit | 0;
		try {
			return this.sec.createArray(this.value.split(<any>separator, limit));
		} catch (e) {
			return this.sec.createArrayUnsafe([this.value]);
		}
	}

	substring(start: number, end?: number) {
		return this.value.substring(start, end);
	}

	substr(from: number, length?: number) {
		if (length == -1) {
			length = this.value.length - from - 1;
		}
		return this.value.substr(from, length);
	}

	toLocaleLowerCase() {
		return this.value.toLowerCase();
	}

	toLowerCase() {
		if (as3Compatibility) {
			return as3ToLowerCase(this.value);
		}
		return this.value.toLowerCase();
	}

	toLocaleUpperCase() {
		return this.value.toUpperCase();
	}

	toUpperCase() {
		return this.value.toUpperCase();
	}

	// The String.prototype versions of these methods are generic, so the implementation is
	// different.

	generic_indexOf(char: string, i?: number) {
		const receiver = this == undefined ? '' : this;
		return String.prototype.indexOf.call(receiver, char, i);
	}

	generic_lastIndexOf(char: string, i?: number) {
		const receiver = this == undefined ? '' : this;
		return String.prototype.lastIndexOf.call(receiver, char, i);
	}

	generic_charAt(index: number) {
		const receiver = this == undefined ? '' : this;
		return String.prototype.charAt.call(receiver, index);
	}

	generic_charCodeAt(index: number) {
		const receiver = this == undefined ? '' : this;
		return String.prototype.charCodeAt.call(receiver, index);
	}

	generic_concat() {
		const receiver = this == undefined ? '' : this;
		// eslint-disable-next-line prefer-rest-params
		return String.prototype.concat.apply(receiver, arguments);
	}

	generic_localeCompare(other: string) {
		const receiver = this.sec.AXString.axBox(String(this));

		// eslint-disable-next-line prefer-spread, prefer-rest-params
		return receiver.localeCompare.apply(receiver, arguments);
	}

	generic_match(pattern) {
		return this.sec.AXString.axBox(String(this)).match(pattern);
	}

	generic_replace(pattern, repl) {
		return this.sec.AXString.axBox(String(this)).replace(pattern, repl);
	}

	generic_search(pattern) {
		return this.sec.AXString.axBox(String(this)).search(pattern);
	}

	generic_slice(start?: number, end?: number) {
		const receiver = this == undefined ? '' : this;
		return String.prototype.slice.call(receiver, start, end);
	}

	generic_split(separator: string, limit?: number) {
		limit = arguments.length < 2 ? 0xffffffff : limit | 0;
		return this.sec.AXString.axBox(String(this)).split(separator, limit);
	}

	generic_substring(start: number, end?: number) {
		const receiver = this == undefined ? '' : this;
		return String.prototype.substring.call(receiver, start, end);
	}

	generic_substr(from: number, length?: number) {
		const receiver = this == undefined ? '' : this;
		return String.prototype.substr.call(receiver, from, length);
	}

	generic_toLowerCase() {
		const receiver = this == undefined ? '' : this;
		if (as3Compatibility) {
			return as3ToLowerCase(String(receiver));
		}
		String.prototype.toLowerCase.call(receiver);
	}

	generic_toUpperCase() {
		const receiver = this == undefined ? '' : this;
		return String.prototype.toUpperCase.call(receiver);
	}

	toString() {
		return this.value.toString();
	}

	public_toString() {
		if (<any> this === this.sec.AXString.dPrototype) {
			return '';
		}
		if (this.axClass !== this.sec.AXString) {
			this.sec.throwError('TypeError', Errors.InvokeOnIncompatibleObjectError,
				'String.prototype.toString');
		}
		return this.value.toString();
	}

	valueOf() {
		return this.value.valueOf();
	}

	public_valueOf() {
		if (<any> this === this.sec.AXString.dPrototype) {
			return '';
		}
		if (this.axClass !== this.sec.AXString) {
			this.sec.throwError('TypeError', Errors.InvokeOnIncompatibleObjectError,
				'String.prototype.valueOf');
		}
		return this.value.valueOf();
	}

	get length(): number {
		return this.value.length;
	}
}
