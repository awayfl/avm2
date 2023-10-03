import { AXGlobal } from './AXGlobal';
import { Errors } from '../errors';
import { CONSTANT } from '../abc/lazy/CONSTANT';
import { Multiname } from '../abc/lazy/Multiname';
import { Namespace } from '../abc/lazy/Namespace';
import { AXObject } from './AXObject';
import { IS_AX_CLASS } from './AXClass';
import { ASFunction } from '../nat/ASFunction';

export class Scope {
	parent: Scope;
	global: Scope;
	object: AXObject;
	isWith: boolean;
	cache: AXObject[];
	defaultNamespace: Namespace;

	public toString(): string {
		return '' + this.parent + ' => ' + this.object + ' ' + this.isWith;
	}

	static ID = 0;
	constructor(parent: Scope, object: AXObject, isWith: boolean = false) {
		Scope.ID++;

		this[IS_AX_CLASS] = true;
		this.init(parent, object, isWith);
	}

	init(parent: Scope, object: AXObject, isWith: boolean = false) {
		this.parent = parent;
		this.object = object;
		this.global = parent ? parent.global : this;
		this.isWith = isWith;
		this.cache = [];
		this.defaultNamespace = null;

		object['__scope__'] = this;
	}

	get superConstructor(): ASFunction | Function {
		const superCtr = (<any> this.object).superClass;

		if (!superCtr) {
			return null;
		}

		const r = superCtr[IS_AX_CLASS] ? superCtr.tPrototype.axInitializer : superCtr;

		// hack!
		// redefine field. Now it always return precomputed field.
		Object.defineProperty(this, 'superConstructor', { value: r });
		return r;
	}

	extend(object: AXObject) {
		if (object === this.object)
			return this;

		const c = object['__scope__'];

		if (c && c.parent == this) {
			return c;
		}

		return new Scope(this, object, false);
	}

	public findDepth(object: any): number {
		let current: Scope = this;
		let depth = 0;
		while (current) {
			if (current.object === object) {
				return depth;
			}
			depth++;
			current = current.parent;
		}
		return -1;
	}

	public getScopeObjects(): Object [] {
		const objects = [];
		let current: Scope = this;
		while (current) {
			objects.unshift(current.object);
			current = current.parent;
		}
		return objects;
	}

	public getScopeProperty(mn: Multiname, strict: boolean, scopeOnly: boolean): AXObject {
		return this.findScopeProperty(mn, strict, scopeOnly).axGetProperty(mn);
	}

	public findScopeProperty(mn: Multiname, strict: boolean, scopeOnly: boolean): AXObject {
		if (mn.mutable || scopeOnly)
			return this._findScopeProperty(mn, strict, scopeOnly);

		if (mn.scope === this.object && !this.isWith)
			return mn.value;

		const value = this._findScopeProperty(mn, strict, scopeOnly);

		if (!this.isWith) {
			mn.value = value;
			mn.scope = this.object;
		}
		return value;
	}

	public _findScopeProperty(mn: Multiname, strict: boolean, scopeOnly: boolean): AXObject {
		// Multinames with a `null` name are the any name, '*'. Need to catch those here, because
		// otherwise we'll get a failing assert in `RuntimeTraits#getTrait` below.
		if (mn.name === null) {
			this.global.object.sec.throwError('ReferenceError', Errors.UndefinedVarError, '*');
		}
		let object: AXObject = this.cache[mn.id];
		if (object)
			return object;

		// Scope lookups should not be trapped by proxies. Except for with scopes, check only trait
		// properties.
		if (this.object && this.object[IS_AX_CLASS] && (this.isWith ?
			this.object.axHasPropertyInternal(mn) :
			this.object.traits.getTrait(mn.namespaces, mn.name))) {
			return (this.isWith || mn.isRuntime()) ? this.object : (this.cache[mn.id] = this.object);
		}
		if (this.parent) {
			object = this.parent.findScopeProperty(mn, strict, scopeOnly);
			if (mn.kind === CONSTANT.QName) {
				this.cache[mn.id] = object;
			}
			return object;
		}
		if (scopeOnly) {
			return null;
		}

		// Attributes can't be stored on globals or be directly defined in scripts.
		if (mn.isAttribute()) {
			this.object.sec.throwError('ReferenceError', Errors.UndefinedVarError, mn.name);
		}

		// If we can't find the property look in the domain.
		const globalObject: AXGlobal = <AXGlobal> this.global.object;
		if ((object = globalObject.applicationDomain.findProperty(mn, strict, true))) {
			return object;
		}

		// If we still haven't found it, look for dynamic properties on the global.
		// No need to do this for non-strict lookups as we'll end up returning the
		// global anyways.
		if (strict) {
			if (!(mn.getPublicMangledName() in globalObject)) {
				this.global.object.sec.throwError('ReferenceError', Errors.UndefinedVarError, mn.name);
			}
		}

		// Can't find it still, return the global object.
		return globalObject;
	}
}