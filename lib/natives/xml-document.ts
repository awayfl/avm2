/**
 * Copyright 2015 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { XMLParserErrorCode, XMLParserBase } from './xml';
import { ASObject  } from '../nat/ASObject';
import { AXSecurityDomain } from '../run/AXSecurityDomain';
import { warning } from '@awayfl/swf-loader';
import { axCoerceString } from '../run/axCoerceString';

enum XMLSpecialChars {
	APOS = 39, // "\'"
	AMP = 38, // "&"
	QUOT = 34, // "\""
	LT = 60, // "<"
	GT = 62, // ">"
}

export class XMLNode extends ASObject {
	constructor (type: number /*uint*/, value: string) {
		type = type >>> 0; value = axCoerceString(value);
		super();
	}

	// Static   JS -> AS Bindings
	// Static   AS -> JS Bindings
	static escapeXML(value: string): string {
		value = axCoerceString(value);
		const length = value.length;
		let i = 0, ch;
		while (i < length) {
			ch = value.charCodeAt(i);
			if (ch === XMLSpecialChars.APOS || ch === XMLSpecialChars.AMP ||
          ch === XMLSpecialChars.QUOT || ch === XMLSpecialChars.LT ||
          ch === XMLSpecialChars.GT) {
				break;
			}
			i++;
		}
		if (i >= length) {
			return value;
		}
		const parts = [value.substring(0, i)];
		while (i < length) {
			switch (ch) {
				case XMLSpecialChars.APOS:
					parts.push('&apos;');
					break;
				case XMLSpecialChars.AMP:
					parts.push('&amp;');
					break;
				case XMLSpecialChars.QUOT:
					parts.push('&quot;');
					break;
				case XMLSpecialChars.LT:
					parts.push('&lt;');
					break;
				case XMLSpecialChars.GT:
					parts.push('&gt;');
					break;
			}
			++i;
			const j = i;
			while (i < length) {
				ch = value.charCodeAt(i);
				if (ch === XMLSpecialChars.APOS || ch === XMLSpecialChars.AMP ||
            ch === XMLSpecialChars.QUOT || ch === XMLSpecialChars.LT ||
            ch === XMLSpecialChars.GT) {
					break;
				}
				i++;
			}
			if (j < i) {
				parts.push(value.substring(j, i));
			}
		}
		return parts.join('');
	}

	// Instance JS -> AS Bindings
	nodeType: number /*uint*/;
	previousSibling: XMLNode;
	nextSibling: XMLNode;
	parentNode: XMLNode;
	firstChild: XMLNode;
	lastChild: XMLNode;
	childNodes: any [];
	_childNodes: any [];
	attributes: ASObject;
	_attributes: ASObject;
	nodeName: string;
	nodeValue: string;
	init: (type: number /*uint*/, value: string) => void;
	hasChildNodes: () => boolean;
	cloneNode: (deep: boolean) => XMLNode;
	removeNode: () => void;
	insertBefore: (node: XMLNode, before: XMLNode) => void;
	appendChild: (node: XMLNode) => void;
	getNamespaceForPrefix: (prefix: string) => string;
	getPrefixForNamespace: (ns: string) => string;
	localName: string;
	prefix: string;
	namespaceURI: string;
	// Instance AS -> JS Bindings
}

export class XMLDocument extends XMLNode {
	constructor (text: string = null) {
		text = axCoerceString(text);
		super(1, '');
	}

	xmlDecl: ASObject;
	docTypeDecl: ASObject;
	idMap: ASObject;
	ignoreWhite: boolean;
	createElement: (name: string) => XMLNode;
	createTextNode: (text: string) => XMLNode;
	parseXML: (source: string) => void;
}

export class XMLTag extends ASObject {
	constructor () {
		super();
	}

	private _type: number = 0;
	private _value: string = null;
	private _empty: boolean = false;
	private _attrs: ASObject = null;

	// Static   JS -> AS Bindings
	// Static   AS -> JS Bindings
	// Instance JS -> AS Bindings
	// Instance AS -> JS Bindings
	get type(): number /*uint*/ {
		return this._type;
	}

	set type(value: number /*uint*/) {
		value = value >>> 0;
		this._type = value;
	}

	get empty(): boolean {
		return this._empty;
	}

	set empty(value: boolean) {
		value = !!value;
		this._empty = value;
	}

	get value(): string {
		return this._value;
	}

	set value(v: string) {
		v = axCoerceString(v);
		this._value = v;
	}

	get attrs(): ASObject {
		return this._attrs;
	}

	set attrs(value: ASObject) {
		this._attrs = value;
	}
}

export class XMLNodeType extends ASObject {
	constructor () {
		super();
	}
	// Static   JS -> AS Bindings
	// Static   AS -> JS Bindings
	// Instance JS -> AS Bindings
	// Instance AS -> JS Bindings
}

function isWhitespace(s: string) {
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (!(ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t')) {
			return false;

		}
	}
	return true;
}

interface XMLParserResult {
	type: number;
	value: string;
	empty?: boolean;
	attrs?: ASObject;
}

class XMLParserForXMLDocument extends XMLParserBase {
	queue: (XMLParserResult|number)[];
	ignoreWhitespace: boolean;
	sec: AXSecurityDomain;

	constructor(sec: AXSecurityDomain) {
		super();
		this.sec = sec;
		this.queue = [];
		this.ignoreWhitespace = false;
	}

	onError(code: XMLParserErrorCode): void {
		this.queue.push(code);
	}

	onPi(name: string, value: string): void {
		warning('Unhandled XMLParserForXMLDocument.onPi');
	}

	onComment(text: string): void {
		warning('Unhandled XMLParserForXMLDocument.onComment');
	}

	onCdata(text: string): void {
		this.queue.push({
			type: 4,
			value: text
		});
	}

	onDoctype(doctypeContent: string): void {
		warning('Unhandled XMLParserForXMLDocument.onDoctype');
	}

	onBeginElement(name: string, attributes: {name: string; value: string}[], isEmpty: boolean): void {
		const attrObj = this.sec.createObject();
		attributes.forEach((a) => {
			attrObj.axSetPublicProperty(a.name, a.value);
		});
		this.queue.push({
			type: 1,
			value: name,
			empty: isEmpty,
			attrs: attrObj
		});
	}

	onEndElement(name: string): void {
		this.queue.push({
			type: 1,
			value: '/' + name
		});
	}

	onText(text: string): void {
		if (this.ignoreWhitespace && isWhitespace(text)) {
			return;
		}
		this.queue.push({
			type: 3,
			value: text
		});
	}
}

export class XMLParser extends ASObject {
	constructor() {
		super();
	}

	private queue: (XMLParserResult|number)[];

	startParse(source: string, ignoreWhite: boolean): void {
		source = axCoerceString(source);
		ignoreWhite = !!ignoreWhite;

		const parser = new XMLParserForXMLDocument(this.sec);
		parser.ignoreWhitespace = ignoreWhite;
		parser.parseXml(source);
		this.queue = parser.queue;
	}

	getNext(tag: XMLTag): number /*int*/ {
		if (this.queue.length === 0) {
			return XMLParserErrorCode.EndOfDocument;
		}
		const nextItem = this.queue.shift();
		if (typeof nextItem === 'number') {
			return nextItem;
		}
		const parseResult = <XMLParserResult>nextItem;
		tag.type = parseResult.type;
		tag.value = parseResult.value;
		tag.empty = parseResult.empty || false;
		tag.attrs = parseResult.attrs || null;
		return XMLParserErrorCode.NoError;
	}
}
