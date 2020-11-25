import { AXSecurityDomain } from '../run/AXSecurityDomain';
import { jsGlobal } from '@awayfl/swf-loader';
import { Errors } from '../errors';
import { wrapJSGlobalFunction } from './wrapJSGlobalFunction';
import { checkValue } from '../run/checkValue';
import { release, assertUnreachable, notImplemented } from '@awayfl/swf-loader';
import { isNullOrUndefined } from '@awayjs/graphics';
import { AXClass } from '../run/AXClass';
import { axCoerceString } from '../run/axCoerceString';
import { getCurrentABC } from '../run/getCurrentABC';
import { NamespaceType } from '../abc/lazy/NamespaceType';
import { Multiname } from '../abc/lazy/Multiname';
import { describeType as describeTypeIntern } from '../natives/describeType';

const getQualifiedClassName = function(_: AXSecurityDomain, value: any): string {
	release || checkValue(value);
	const valueType = typeof value;
	switch (valueType) {
		case 'undefined':
	  return 'void';
		case 'object':
	  if (value === null) {
				return 'null';
	  }
	  return value.classInfo.instanceInfo.name.toFQNString(false);
		case 'number':
	  return (value | 0) === value ? 'int' : 'Number';
		case 'string':
	  return 'String';
		case 'boolean':
	  return 'Boolean';
	}
	release || assertUnreachable('invalid value type ' + valueType);
};
/**
 * Other natives can live in this module
 */

export var Natives = {
	print: function(sec: AXSecurityDomain, expression: any, arg1?: any, arg2?: any, arg3?: any, arg4?: any) {
		let message;
		const objects = [];
		if (arguments.length == 2) {
			message = arguments[1] ? arguments[1].toString() : arguments[1];
			if (typeof arguments[1] !== 'string') objects.push(arguments[1]);
		} else {
			message = '';
			for (let i = 1; i < arguments.length;i++) {
				message += arguments[i] ? arguments[i].toString() : arguments[i];
				if (typeof arguments[i] !== 'string') objects.push(arguments[i]);
				if (i != arguments.length - 1) {
					message += ' ';
				}

			}
		}
		console.log('%c Trace from SWF:', 'color: DodgerBlue', message, objects.length == 0 ? '' : objects);
		if (message == 'debugger') {
			debugger;
		}
	},
	debugBreak: function(v: any) {
		/* tslint:disable */
		debugger;
		/* tslint:enable */
	},
	bugzilla: function(_: AXSecurityDomain, n) {
		switch (n) {
			case 574600: // AS3 Vector::map Bug
				return true;
		}
		return false;
	},
	decodeURI: function(sec: AXSecurityDomain, encodedURI: string): string {
		try {
			return jsGlobal.decodeURI(encodedURI);
		} catch (e) {
			sec.throwError('URIError', Errors.InvalidURIError, 'decodeURI');
		}
	},
	decodeURIComponent: function(sec: AXSecurityDomain, encodedURI: string): string {
		try {
			return jsGlobal.decodeURIComponent(encodedURI);
		} catch (e) {
			sec.throwError('URIError', Errors.InvalidURIError, 'decodeURIComponent');
		}
	},
	encodeURI: function(sec: AXSecurityDomain, uri: string): string {
		try {
			return jsGlobal.encodeURI(uri);
		} catch (e) {
			sec.throwError('URIError', Errors.InvalidURIError, 'encodeURI');
		}
	},
	encodeURIComponent: function(sec: AXSecurityDomain, uri: string): string {
		try {
			return jsGlobal.encodeURIComponent(uri);
		} catch (e) {
			sec.throwError('URIError', Errors.InvalidURIError, 'encodeURIComponent');
		}
	},
	isNaN: wrapJSGlobalFunction(jsGlobal.isNaN),
	isFinite: wrapJSGlobalFunction(jsGlobal.isFinite),
	parseInt: wrapJSGlobalFunction(jsGlobal.parseInt),
	parseFloat: wrapJSGlobalFunction(jsGlobal.parseFloat),
	escape: wrapJSGlobalFunction(jsGlobal.escape),
	unescape: wrapJSGlobalFunction(jsGlobal.unescape),
	isXMLName: function () {
		return false; // "FIX ME";
	},
	notImplemented: wrapJSGlobalFunction(notImplemented),

	/**
     * Returns the fully qualified class name of an object.
     */
	getQualifiedClassName(_: AXSecurityDomain, value: any): string {
		return getQualifiedClassName(_, value);
	},

	/**
     * Returns the fully qualified class name of the base class of the object specified by the
     * |value| parameter.
     */
	getQualifiedSuperclassName(sec: AXSecurityDomain, value: any) {
		if (isNullOrUndefined(value)) {
			return 'null';
		}
		value = sec.box(value);
		// The value might be from another domain, so don't use passed-in the current
		// AXSecurityDomain.
		const axClass = value.sec.AXClass.axIsType(value) ?
			(<AXClass>value).superClass :
			value.axClass.superClass;
		return getQualifiedClassName(sec, axClass);
	},
	/**
     * Returns the class with the specified name, or |null| if no such class exists.
     */
	getDefinitionByName(sec: AXSecurityDomain, name: string): AXClass {
		name = axCoerceString(name).replace('::', '.');
		const mn = Multiname.FromFQNString(name, NamespaceType.Public);
		return getCurrentABC().env.app.getClass(mn);
	},
	describeType(sec: AXSecurityDomain, value: any, flags: number): any {
		console.log('describeType not implemented');
		return describeTypeIntern(sec, value, flags);
	},
	describeTypeJSON(sec: AXSecurityDomain, value: any, flags: number) {
		console.log('describeTypeJSON not implemented');
		return null;//describeTypeJSON(sec, value, flags);
	},
	getArgv(): any [] {
		return null;
	}

};