import { IMetaobjectProtocol } from '../run/IMetaobjectProtocol';
import { RuntimeTraits } from '../abc/lazy/RuntimeTraits';
import { ClassInfo } from '../abc/lazy/ClassInfo';
import { Multiname } from '../abc/lazy/Multiname';
import { AXSecurityDomain } from '../run/AXSecurityDomain';
import { Scope } from '../run/Scope';
import { AXFunction } from '../run/AXFunction';
import { Bytecode } from '../abc/ops';
import { release, isNumeric, defineNonEnumerableProperty } from '@awayfl/swf-loader';
import { addPrototypeFunctionAlias } from './addPrototypeFunctionAlias';
import { checkValue } from '../run/checkValue';
import { makeMultiname } from './makeMultiname';
import { axCoerceString } from '../run/axCoerceString';
import { qualifyPublicName } from '../nat/qualifyPublicName';
import { axCoerceName } from '../run/axCoerceName';
import { assert } from '@awayjs/graphics';
import { rn } from './rn';
import { Errors } from '../errors';
import { TRAIT } from '../abc/lazy/TRAIT';
import { AXClass } from '../run/AXClass';
import { validateCall } from '../run/validateCall';
import { validateConstruct } from '../run/validateConstruct';
import { AXObject } from '../run/AXObject';

export class ASObject implements IMetaobjectProtocol {
	traits: RuntimeTraits;
	sec: AXSecurityDomain;

	static forceNativeConstructor?: boolean = false;
	static forceNativeMethods?: boolean = false;
	
	// Declare all instance ASObject fields as statics here so that the TS
	// compiler can convert ASClass class objects to ASObject instances.

	static traits: RuntimeTraits;
	static dPrototype: ASObject;
	static tPrototype: ASObject;
	protected static _methodClosureCache: any;
	static classNatives: Object[];
	static instanceNatives: Object[];
	static sec: AXSecurityDomain;
	static classSymbols = null;
	static instanceSymbols = null;
	static classInfo: ClassInfo;

	static axResolveMultiname: (mn: Multiname) => any;
	static axHasProperty: (mn: Multiname) => boolean;
	static axDeleteProperty: (mn: Multiname) => boolean;
	static axCallProperty: (mn: Multiname, argArray: any[], isLex: boolean) => any;
	static axCallSuper: (mn: Multiname, scope: Scope, argArray: any[]) => any;
	static axConstructProperty: (mn: Multiname, args: any[]) => any;
	static axHasPropertyInternal: (mn: Multiname) => boolean;
	static axHasOwnProperty: (mn: Multiname) => boolean;
	static axSetProperty: (mn: Multiname, value: any, bc: Bytecode) => void;
	static axInitProperty: (mn: Multiname, value: any) => void;
	static axGetProperty: (mn: Multiname) => any;
	static axGetMethod: (name: string) => AXFunction;
	static axGetSuper: (mn: Multiname, scope: Scope) => any;
	static axSetSuper: (mn: Multiname, scope: Scope, value: any) => void;

	static axEnumerableKeys: any[];
	static axGetEnumerableKeys: () => any[];
	static axHasPublicProperty: (nm: any) => boolean;
	static axSetPublicProperty: (nm: any, value: any) => void;
	static axGetPublicProperty: (nm: any) => any;
	static axCallPublicProperty: (nm: any, argArray: any[]) => any;
	static axDeletePublicProperty: (nm: any) => boolean;

	static axSetNumericProperty: (nm: number, value: any) => void;
	static axGetNumericProperty: (nm: number) => any;

	static axCoerce: (v: any) => any;
	static axConstruct: (argArray?: any[]) => any;

	static axNextNameIndex: (index: number) => number;
	static axNextName: (index: number) => any;
	static axNextValue: (index: number) => any;

	static axGetSlot: (i: number) => any;
	static axSetSlot: (i: number, value: any) => void;

	static axIsType: (value: any) => boolean;

	static getPrototypeOf: () => boolean;
	static native_isPrototypeOf: (nm: string) => boolean;
	static native_hasOwnProperty: (nm: string) => boolean;
	static native_propertyIsEnumerable: (nm: string) => boolean;
	static native_setPropertyIsEnumerable: (nm: string, enumerable?: boolean) => boolean;

	static classInitializer() {
		const proto: any = this.dPrototype;
		const asProto: any = ASObject.prototype;
		addPrototypeFunctionAlias(proto, '$BghasOwnProperty', asProto.native_hasOwnProperty);
		addPrototypeFunctionAlias(proto, '$BgpropertyIsEnumerable',
			asProto.native_propertyIsEnumerable);
		addPrototypeFunctionAlias(proto, '$BgsetPropertyIsEnumerable',
			asProto.native_setPropertyIsEnumerable);
		addPrototypeFunctionAlias(proto, '$BgisPrototypeOf', asProto.native_isPrototypeOf);
		addPrototypeFunctionAlias(proto, '$BgtoLocaleString', asProto.toString);
	}

	constructor() {
		// To prevent accidental instantiation of template classes, make sure that we throw
		// right during construction.
		release;// 80pro: this errors when instancing our Loader class: || checkValue(this);
	}

	static _init() {
		// Nop.
	}

	static init() {
		// Nop.
	}

	static axClass: any;
	static axClassName: string;
	axClass: any;
	axClassName: string;

	getPrototypeOf: () => any;

	native_isPrototypeOf(v: any): boolean {
		return this.isPrototypeOf(this.sec.box(v));
	}

	native_hasOwnProperty(nm: string): boolean {
		return this.axHasOwnProperty(makeMultiname(nm));
	}

	native_propertyIsEnumerable(nm: string): boolean {
		const descriptor = Object.getOwnPropertyDescriptor(this, qualifyPublicName(axCoerceString(nm)));
		return !!descriptor && descriptor.enumerable;
	}

	native_setPropertyIsEnumerable(nm: string, enumerable: boolean = true): void {
		const qualifiedName = qualifyPublicName(axCoerceString(nm));
		enumerable = !!enumerable;
		const instanceInfo = this.axClass.classInfo.instanceInfo;
		if (instanceInfo.isSealed() && this !== this.axClass.dPrototype) {
			this.sec.throwError('ReferenceError', Errors.WriteSealedError, nm, instanceInfo.name.name);
		}
		// Silently ignore trait properties.
		var descriptor = Object.getOwnPropertyDescriptor(this.axClass.tPrototype, qualifiedName);
		if (descriptor && this !== this.axClass.dPrototype) {
			return;
		}
		var descriptor = Object.getOwnPropertyDescriptor(this, qualifiedName);
		// ... and non-existent properties.
		if (!descriptor) {
			return;
		}
		if (descriptor.enumerable !== enumerable) {
			descriptor.enumerable = enumerable;
			Object.defineProperty(this, qualifiedName, descriptor);
		}
	}

	axResolveMultiname(mn: Multiname): any {
		if (mn.numeric)
			return mn.numericValue;

		const s = mn.name;

		if (mn.mutable) {
			const t = this.traits.getTrait(mn.namespaces, s);
			return t ? t.name.getMangledName() : '$Bg' + s;
		} else {
			const c = mn.resolved[this.axClassName];

			if (c)
				return c;

			const t = this.traits.getTraitMultiname(mn);

			const r = t ? t.name.getMangledName() : ('$Bg' + s);

			mn.resolved[this.axClassName] = r;

			return r;
		}
	}

	axHasProperty(mn: Multiname): boolean {
		return this.axHasPropertyInternal(mn);
	}

	axHasPublicProperty(nm: any): boolean {
		rn.name = nm;
		if (typeof nm === 'number') {
			rn.numeric = true;
			rn.numericValue = nm;
		}
		const result = this.axHasProperty(rn);
		release || assert(rn.name === nm || isNaN(rn.name) && isNaN(nm));
		return result;
	}

	axSetProperty(mn: Multiname, value: any, bc: Bytecode) {
		//if(typeof value == "number" && isNaN(value))
		//    console.log("try to set NaN", mn);
		release || checkValue(value);
		let name = mn.name;
		if (typeof name === 'number' || isNumeric(name = axCoerceName(name))) {
			release || assert(mn.isRuntimeName());
			this[+name] = value;
			return;
		}
		let freeze = false;
		const t = this.traits.getTrait(mn.namespaces, name);
		if (t) {
			var mangledName = t.name.getMangledName();
			switch (t.kind) {
				case TRAIT.Method:
					this.sec.throwError('ReferenceError', Errors.CannotAssignToMethodError, name,
						this.axClass.name.name);
					// Unreachable because of throwError.
				case TRAIT.Getter:
					this.sec.throwError('ReferenceError', Errors.ConstWriteError, name,
						this.axClass.name.name);
					// Unreachable because of throwError.
				case TRAIT.Class:
				case TRAIT.Const:
					// Technically, we need to check if the currently running function is the
					// initializer of whatever class/package the property is initialized on.
					// In practice, we freeze the property after first assignment, causing
					// an internal error to be thrown if it's being initialized a second time.
					// Invalid bytecode could leave out the assignent during first initialization,
					// but it's hard to see how that could convert into real-world problems.
					if (bc !== Bytecode.INITPROPERTY) {
						this.sec.throwError('ReferenceError', Errors.ConstWriteError, name,
							this.axClass.name.name);
					}
					freeze = true;
					break;
			}
			const type = t.getType();
			if (type)
				value = type.axCoerce(value);

		} else {
			mangledName = '$Bg' + name;
		}

		//	hack when value is a XMLList returned from "attribute" getter
		//	when working with xml
		if (value && value._children && value._children.length == 1
		&& value._children[0]._value) {
			value = parseInt(value._children[0]._value);
		}

		this[mangledName] = value;
		if (freeze) {
			Object.defineProperty(this, mangledName, { writable: false });
		}
	}

	axGetProperty(mn: Multiname): any {
		const name = this.axResolveMultiname(mn);

		let value = this[name];

		if (typeof value === 'function')
			return this.axGetMethod(name);

		//80pro: workaround:
		if (typeof value === 'undefined' && typeof name !== 'number')
			value = this[name.replace('$Bg', '')];

		release || checkValue(value);
		return value;
	}

	protected _methodClosureCache: any;

	axGetMethod(name: string): AXFunction {
		release || assert(typeof this[name] === 'function');
		let cache = this._methodClosureCache;
		if (!cache) {
			Object.defineProperty(this, '_methodClosureCache', { value: Object.create(null) });
			cache = this._methodClosureCache;
		}
		let method = cache[name];
		if (!method) {
			method = cache[name] = this.sec.AXMethodClosure.Create(<any> this, this[name]);
		}
		return method;
	}

	axGetSuper(mn: Multiname, scope: Scope): any {
		
		const name = axCoerceName(mn.name);
		const namespaces = mn.namespaces;
		const trait = (<AXClass>scope.parent.object).tPrototype.traits.getTrait(namespaces, name);
		let value;
		if (trait.kind === TRAIT.Getter || trait.kind === TRAIT.GetterSetter) {
			value = trait.get.call(this);
		} else {
			const mangledName = trait.name.getMangledName();			
			const fun = (<AXClass>scope.parent.object).tPrototype[mangledName];
			if (fun)
				return this.sec.AXMethodClosure.Create(<any> this, fun);
		}
		release || checkValue(value);
		return value;
	}

	axSetSuper(mn: Multiname, scope: Scope, value: any) {
		release || checkValue(value);
		const name = axCoerceName(mn.name);
		const namespaces = mn.namespaces;
		const trait = (<AXClass>scope.parent.object).tPrototype.traits.getTrait(namespaces, name);
		const type = trait.getType();
		if (type) {
			value = type.axCoerce(value);
		}
		if (trait.kind === TRAIT.Setter || trait.kind === TRAIT.GetterSetter) {
			trait.set.call(this, value);
		} else {
			this[trait.name.getMangledName()] = value;
		}
	}

	axDeleteProperty(mn: Multiname): any {
		// Cannot delete traits.
		const name = axCoerceName(mn.name);
		const namespaces = mn.namespaces;
		if (this.traits.getTrait(namespaces, name)) {
			return false;
		}
		return delete this[mn.getPublicMangledName()];
	}

	axCallProperty(mn: Multiname, args: any[], isLex: boolean): any {
		const fun = this[this.axResolveMultiname(mn)];
		//console.log("call function name:", name);
		validateCall(this.sec, fun, args.length);
		return fun.axApply(isLex ? null : this, args);
	}

	axCallSuper(mn: Multiname, scope: Scope, args: any[]): any {
		const fun = (<AXClass>scope.parent.object).tPrototype[this.axResolveMultiname(mn)];
		validateCall(this.sec, fun, args.length);
		return fun.axApply(this, args);
	}

	axConstructProperty(mn: Multiname, args: any[]): any {
		const ctor = this[this.axResolveMultiname(mn)];
		validateConstruct(this.sec, ctor, args.length);
		return ctor.axConstruct(args);
	}

	axHasPropertyInternal(mn: Multiname): boolean {
		return this.axResolveMultiname(mn) in this;
	}

	axHasOwnProperty(mn: Multiname): boolean {
		const name = this.axResolveMultiname(mn);
		// We have to check for trait properties too if a simple hasOwnProperty fails.
		// This is different to JavaScript's hasOwnProperty behaviour where hasOwnProperty returns
		// false for properties defined on the property chain and not on the instance itself.
		return this.hasOwnProperty(name) || this.axClass.tPrototype.hasOwnProperty(name);
	}

	axGetEnumerableKeys(): any[] {
		if (this.sec.isPrimitive(this)) {
			return [];
		}
		const tPrototype = Object.getPrototypeOf(this);
		const keys = Object.keys(this);
		const result = [];
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			if (isNumeric(key)) {
				result.push(key);
			} else {
				if (tPrototype.hasOwnProperty(key)) {
					continue;
				}
				const name = Multiname.stripPublicMangledName(key);
				if (name !== undefined) {
					result.push(name);
				}
			}
		}
		return result;
	}

	axGetPublicProperty(nm: any): any {
		return this[Multiname.getPublicMangledName(nm)];
	}

	axSetPublicProperty(nm: any, value: any) {
		release || checkValue(value);
		this[Multiname.getPublicMangledName(nm)] = value;
	}

	axCallPublicProperty(nm: any, argArray: any[]): any {
		return this[Multiname.getPublicMangledName(nm)].axApply(this, argArray);
	}

	axDeletePublicProperty(nm: any): boolean {
		return delete this[Multiname.getPublicMangledName(nm)];
	}

	axGetSlot(i: number): any {
		const t = this.traits.getSlot(i);
		const value = this[t.name.getMangledName()];
		release || checkValue(value);
		return value;
	}

	axSetSlot(i: number, value: any) {
		release || checkValue(value);
		const t = this.traits.getSlot(i);
		const name = t.name.getMangledName();
		const type = t.getType();
		this[name] = type ? type.axCoerce(value) : value;
	}

	/**
     * Gets the next name index of an object. Index |zero| is actually not an
     * index, but rather an indicator to start the iteration.
     */
	axNextNameIndex(index: number): number {
		const self: AXObject = <any> this;
		if (index === 0) {
			// Gather all enumerable keys since we're starting a new iteration.
			defineNonEnumerableProperty(self, 'axEnumerableKeys', self.axGetEnumerableKeys());
		}

		rn.drop();

		const axEnumerableKeys = self.axEnumerableKeys;
		while (index < axEnumerableKeys.length) {
			rn.name = axEnumerableKeys[index];
			if (self.axHasPropertyInternal(rn)) {
				release || assert(rn.name === axEnumerableKeys[index]);
				return index + 1;
			}
			index++;
		}
		return 0;
	}

	/**
     * Gets the nextName after the specified |index|, which you would expect to
     * be index + 1, but it's actually index - 1;
     */
	axNextName(index: number): any {
		const self: AXObject = <any> this;
		const axEnumerableKeys = self.axEnumerableKeys;
		release || assert(axEnumerableKeys && index > 0 && index < axEnumerableKeys.length + 1);
		return axEnumerableKeys[index - 1];
	}

	axNextValue(index: number): any {
		return this.axGetPublicProperty(this.axNextName(index));
	}

	axSetNumericProperty(nm: number, value: any) {
		this.axSetPublicProperty(nm, value);
	}

	axGetNumericProperty(nm: number): any {
		return this.axGetPublicProperty(nm);
	}

	axEnumerableKeys: any[];
}