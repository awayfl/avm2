
import { Multiname } from "./../abc/lazy/Multiname"
import { BOX2D_PREFERENCE } from "./../external";

export const IS_EXTERNAL_CLASS = Symbol("External instance");
type Ctr = { new ():Object };

const LONG_NAMES = /nape./;

let extClassLib = undefined;

export function getExtClassField(mn: Multiname, lib: Object, strict: boolean = false): Ctr | null {
	if(!lib || !mn || !mn.name || mn.numeric) {
		return null;
	}

	const name = mn.name;
	const ns = mn.namespace?.uri;

	// fast check, for Box2D
	if(!strict && typeof lib[name] !== 'undefined') {
		return lib[name];
	}

	// nape?
	if(strict && ns && LONG_NAMES.test(ns)) {
		const lookup = ns.split(".");

		let trace = lib;

		for(let child of lookup) {
			trace = lib[child];
			if(!trace) {
				return null;
			}
		}

		return trace[name];
	}

	return null;
}
/**
 * Try construct object from external lib, like as Box2D or Nape
 * @param mn {Multiname}
 * @param args {any[]}
 */
export function extClassContructor(mn: Multiname, args: any[]) {
	if(!extClassLib) {
		extClassLib = BOX2D_PREFERENCE.prefer;
	}

	if(!extClassLib) {
		return null;
	}

	const ns = mn.namespace?.uri;
	const Constructor = getExtClassField(mn, extClassLib, ns ? LONG_NAMES.test(ns): false);

	if(typeof Constructor !== 'function') {
		return null;
	}

	// faster that Object.create;
	// class constructor optimized in v8 and WebKit
	// s ... rollup issues =(
	const obj = Object.create(Constructor.prototype)
	Constructor.apply(obj, args);

    // force fast mode;
    // legacy
    obj.__fast__ = true;
    obj[IS_EXTERNAL_CLASS] = true;
	return obj;
}
