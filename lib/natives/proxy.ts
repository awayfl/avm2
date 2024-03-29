/*
 * Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Multiname } from '../abc/lazy/Multiname';
import { CONSTANT } from '../abc/lazy/CONSTANT';
import { internNamespace } from '../abc/lazy/internNamespace';
import { NamespaceType } from '../abc/lazy/NamespaceType';
import { defineNonEnumerableProperty } from '@awayfl/swf-loader';
import { ASObject } from '../nat/ASObject';
import { Errors } from '../errors';
import { Bytecode } from '../abc/ops';

const proxyNamespace = internNamespace(NamespaceType.Public, 'http://www.adobe.com/2006/actionscript/flash/proxy');
const proxyPrefix = '$' + proxyNamespace.mangledName;

/**
 * The Proxy class lets you override the default behavior of ActionScript operations
 * (such as retrieving and modifying properties) on an object.
 */
export class ASProxy extends ASObject {

	static classInitializer() {
		const proto: any = this.dPrototype;
		const asProto: any = ASProxy.prototype;

		defineNonEnumerableProperty(proto, proxyPrefix + 'getProperty', asProto.native_getProperty);
		defineNonEnumerableProperty(proto, proxyPrefix + 'setProperty', asProto.native_setProperty);
		defineNonEnumerableProperty(proto, proxyPrefix + 'callProperty', asProto.native_callProperty);
		defineNonEnumerableProperty(proto, proxyPrefix + 'hasProperty', asProto.native_hasProperty);
		defineNonEnumerableProperty(proto, proxyPrefix + 'deleteProperty', asProto.native_deleteProperty);
		defineNonEnumerableProperty(proto, proxyPrefix + 'getDescendants', asProto.native_getDescendants);
		defineNonEnumerableProperty(proto, proxyPrefix + 'nextNameIndex', asProto.native_nextNameIndex);
		defineNonEnumerableProperty(proto, proxyPrefix + 'nextName', asProto.native_nextName);
		defineNonEnumerableProperty(proto, proxyPrefix + 'nextValue', asProto.native_nextValue);
	}

	native_getProperty() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyGetPropertyError);
	}

	native_setProperty() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxySetPropertyError);
	}

	native_callProperty() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyCallPropertyError);
	}

	native_hasProperty() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyHasPropertyError);
	}

	native_deleteProperty() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyDeletePropertyError);
	}

	native_getDescendants() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyGetDescendantsError);
	}

	native_nextNameIndex() {
		// Enumeration traverses the prototype chain. For proxies, this causes problems
		// because a Proxy-extending class has the MOP override for `axNextNameIndex`, but can't
		// have the `nextNameIndex` hook defined and thus hits this default hook. In that case,
		// we'd incorrectly throw an error instead of just returning null if we didn't
		// special-case here.
		if (this === <any> this.axClass.dPrototype) {
			return;
		}
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyNextNameIndexError);
	}

	native_nextName() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyNextNameError);
	}

	native_nextValue() {
		this.sec.throwError('flash.errors.IllegalOperationError', Errors.ProxyNextValueError);
	}

	public axGetProperty(mn: Multiname) {
		let value: any;
		const trait = typeof mn.name === 'string' ? this.traits.getTrait(mn.namespaces, mn.name) : null;
		if (trait) {
			const name = trait.multiname.getMangledName();
			value = this[name];
			if (typeof value === 'function') {
				return this.axGetMethod(name);
			}
		} else {
			value = this[proxyPrefix + 'getProperty'](this.sec.AXQName.FromMultiname(mn));
		}
		return value;
	}

	public axGetNumericProperty(name: number): any {
		return this[proxyPrefix + 'getProperty']((+name) + '');
	}

	public axSetNumericProperty(name: number, value: any) {
		this[proxyPrefix + 'setProperty']((+name) + '', value);
	}

	public axSetProperty(mn: Multiname, value: any, bc: Bytecode) {
		const trait = typeof mn.name === 'string' ? this.traits.getTrait(mn.namespaces, mn.name) : null;
		if (trait) {
			super.axSetProperty(mn, value, bc);
			return;
		}
		this[proxyPrefix + 'setProperty'](this.sec.AXQName.FromMultiname(mn), value);
	}

	public axCallProperty(mn: Multiname, args: any[], isLex: boolean): any {
		const trait = typeof mn.name === 'string' ? this.traits.getTrait(mn.namespaces, mn.name) : null;
		if (trait) {
			return super.axCallProperty(mn, args, isLex);
		}
		const callArgs = [this.sec.AXQName.FromMultiname(mn)].concat(args);
		return this[proxyPrefix + 'callProperty'](...callArgs);
	}

	public axHasProperty(mn: Multiname): any {
		return this.axHasOwnProperty(mn);
	}

	public axHasPublicProperty(nm: string): any {
		rn.name = nm;
		if (this.axHasPropertyInternal(rn)) {
			return true;
		}
		return this[proxyPrefix + 'hasProperty'](nm);
	}

	public axHasOwnProperty(mn: Multiname): any {
		const trait = typeof mn.name === 'string' ? this.traits.getTrait(mn.namespaces, mn.name) : null;
		if (trait) {
			return true;
		}
		return this[proxyPrefix + 'hasProperty'](this.sec.AXQName.FromMultiname(mn));
	}

	public axDeleteProperty(mn: Multiname): any {
		const trait = typeof mn.name === 'string' ? this.traits.getTrait(mn.namespaces, mn.name) : null;
		if (trait) {
			return delete this[trait.multiname.getMangledName()];
		}
		return this[proxyPrefix + 'deleteProperty'](this.sec.AXQName.FromMultiname(mn));
	}

	public axNextName(index: number): any {
		return this[proxyPrefix + 'nextName'](index);
	}

	public axNextValue(index: number): any {
		return this[proxyPrefix + 'nextValue'](index);
	}

	public axNextNameIndex(index: number): number {
		return this[proxyPrefix + 'nextNameIndex'](index);
	}
}

const rn = new Multiname(null, 0, CONSTANT.RTQNameL, [], null, null, true);