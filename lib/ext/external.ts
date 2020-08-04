import { Multiname } from "./../abc/lazy/Multiname";
import { BOX2D_PREFERENCE } from "./../external";

export const IS_EXTERNAL_CLASS = Symbol("External class marker");
type Ctr = { new (): Object };

const LONG_NAMES = /nape./;

let extClassLib = undefined;
export function getExtClassField(name: string, namespace: string = undefined): Ctr | null {
	const lib = extClassLib  || (extClassLib =  BOX2D_PREFERENCE.prefer);

	if (!lib || !name) {
		return null;
	}

	// fast check, for Box2D
	if (!namespace || typeof lib[name] !== "undefined") {
		return lib[name];
	}

	if(!namespace) {
		return null;
	}

	let trace = lib;
	let path = namespace.split(".");

	for (let child of path) {
		trace = trace[child];
		if (!trace) {
			return null;
		}
	}

	return trace[name] as Ctr;
}
/**
 * Try construct object from external lib, like as Box2D or Nape
 * @param mn {Multiname}
 * @param args {any[]}
 */
export function extClassContructor(mn: Multiname, args: any[]) {
	if (!extClassLib) {
		extClassLib = BOX2D_PREFERENCE.prefer;
	}

	if (!extClassLib) {
		return null;
	}

	const ns = mn.namespace?.uri;
	const name = mn.name;
	const isLong = ns && LONG_NAMES.test(ns);

	const Constructor = getExtClassField(name, isLong ? ns : undefined);

	if (typeof Constructor !== "function") {
		return null;
	}

	Object.defineProperty(Constructor.prototype, IS_EXTERNAL_CLASS,  {
		value: true
	})
	// faster that Object.create;
	// class constructor optimized in v8 and WebKit
	// s ... rollup issues =(
	const obj = Object.create(Constructor.prototype);
	Constructor.apply(obj, args);

	// force fast mode;
	// legacy
	obj.__fast__ = true;
	return obj;
}

export function emitIsAX(name: string) {
	if(!BOX2D_PREFERENCE.prefer) {
		return 'true';
	}

	return `(${name} != undefined && ${name}[AX_CLASS_SYMBOL])`	
}

export function needFastCheck() {
	return !!BOX2D_PREFERENCE.prefer;
}

export function emitIsAXOrPrimitive(name: string, explictNull = false): string {
	if(!BOX2D_PREFERENCE.prefer) {
		return 'true';
	}
	const nullTest = explictNull ? `` : `|| ${name} == null`;
	return `(_a = typeof ${name}, ((_a !== 'object' && _a !== 'function' ) ${nullTest} || ${name}[AX_CLASS_SYMBOL]))`
}

export function emitIsCallableNative(name: string, func: string) {
	if(!BOX2D_PREFERENCE.prefer) {
		return 'false';
	}
	return `( !${name}[AX_CLASS_SYMBOL] && typeof ${name}['${func}'] === 'function')`;
}
