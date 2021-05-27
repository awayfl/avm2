import { Multiname } from '../abc/lazy/Multiname';

export const IS_EXTERNAL_CLASS = Symbol('External class marker');
type Ctr = { new (): Object };

const LONG_NAMES = /nape./;

export const extClasses = {
	_lib: null,
	set lib(v: any) {
		v && console.debug('[AVM2] Register external lib:', v);
		this._lib = v;
	},

	get lib() {
		return this._lib;
	}
};

export function getExtClassField(name: string, namespace: string = undefined): Ctr | null {
	const lib = extClasses._lib;

	if (!lib || !name)
		return null;

	// fast check, for Box2D
	if (!namespace || typeof lib[name] !== 'undefined')
		return lib[name];

	if (!namespace)
		return null;

	let trace = lib;
	const path = namespace.split('.');

	for (const child of path) {
		trace = trace[child];
		if (!trace) {
			return null;
		}
	}

	return trace[name] as Ctr;
}
/**
 * Try construct object from external lib, like as Box2D or Nape
 * @param mn
 * @param args
 */
export function extClassContructor(mn: Multiname, args: any[]) {
	if (!extClasses._lib)
		return null;

	const ns = mn.namespace?.uri;
	const name = mn.name;
	const isLong = ns && LONG_NAMES.test(ns);

	const Constructor = getExtClassField(name, isLong ? ns : undefined);

	if (typeof Constructor !== 'function') {
		return null;
	}

	Object.defineProperty(Constructor.prototype, IS_EXTERNAL_CLASS,  {
		value: true
	});

	const obj = Reflect.construct(Constructor, args);

	// force fast mode;
	// legacy
	obj.__fast__ = true;
	return obj;
}

export function emitIsAX(name: string) {
	if (!extClasses._lib)
		return 'true';

	return `(${name} != undefined && ${name}[AX_CLASS_SYMBOL])`;
}

export function needFastCheck() {
	return !!extClasses._lib;
}

export function emitIsAXOrPrimitive(name: string, explictNull = false): string {
	if (!extClasses._lib)
		return 'true';

	const nullTest = explictNull ? '' : `|| ${name} == null`;
	return `(_a = typeof ${name}, ((_a !== 'object' && _a !== 'function' ) ${nullTest} || ${name}[AX_CLASS_SYMBOL]))`;
}

export function emitIsCallableNative(name: string, func: string) {
	if (!extClasses._lib)
		return 'false';

	return `( !${name}[AX_CLASS_SYMBOL] && typeof ${name}['${func}'] === 'function')`;
}
