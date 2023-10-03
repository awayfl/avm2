import { Multiname } from '../abc/lazy/Multiname';
import { ASObject } from '../nat/ASObject';
import { addPrototypeFunctionAlias } from '../nat/addPrototypeFunctionAlias';
import { assert } from '@awayjs/graphics';
import { release } from '@awayfl/swf-loader';
import { Bytecode } from '../abc/ops';
import { Settings } from '../Settings';

const USE_WEAK = ('WeakRef' in self) && Settings.USE_WEAK_REF;

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

/**
 * TODO: We need a more robust Dictionary implementation that doesn't only give you back
 * string keys when enumerating.
 */
export class Dictionary extends ASObject {
	static classInitializer: any = function() {
		const proto: any = this.dPrototype;
		const asProto: any = Dictionary.prototype;
		addPrototypeFunctionAlias(proto, '$BgtoJSON', asProto.toJSON);
	}

	private map: WeakMap<any, any> = new WeakMap();
	private refs: WeakMap<any, WeakRef<any>>;
	private keys: Set<any> = new Set();
	private weakKeys: boolean;
	private primitiveMap: Record< string | number, any> = Object.create(null);

	constructor(weakKeys: boolean = false) {
		super();

		if ((this.weakKeys = !!weakKeys && USE_WEAK))
			this.refs = new WeakMap();
	}

	static makePrimitiveKey(key: any) {
		if (typeof key === 'string' || typeof key === 'number')
			return key;

		release || assert(typeof key === 'object' || typeof key === 'function', typeof key);
		return undefined;
	}

	toJSON() {
		return 'Dictionary';
	}

	public axGetProperty(mn: Multiname): any {
		if (<any> this === this.axClass.dPrototype) {
			return super.axGetProperty(mn);
		}
		const key = Dictionary.makePrimitiveKey(mn.name);
		if (key !== undefined) {
			return this.primitiveMap[key];
		}
		return this.map.get(Object(mn.name));
	}

	public axSetProperty(mn: Multiname, value: any, bc: Bytecode) {
		if (<any> this === this.axClass.dPrototype) {
			super.axSetProperty(mn, value, bc);
			return;
		}
		const key = Dictionary.makePrimitiveKey(mn.name);
		if (key !== undefined) {
			this.primitiveMap[key] = value;
			return;
		}

		const okey = Object(mn.name);

		if (!this.map.has(okey)) {
			if (this.weakKeys) {
				const wkey = new self.WeakRef(okey);
				this.refs.set(okey, wkey);
				this.keys.add(wkey);
			} else {
				this.keys.add(okey);
			}
		}

		this.map.set(okey, value);
	}

	// TODO: Not implemented yet.
	// public axCallProperty(mn: Multiname, args: any []) {
	//   release || release || notImplemented("axCallProperty");
	// }

	public axHasPropertyInternal(mn: Multiname) {
		if (<any> this === this.axClass.dPrototype) {
			return super.axHasProperty(mn);
		}
		const key = Dictionary.makePrimitiveKey(mn.name);
		if (key !== undefined) {
			return <any>key in this.primitiveMap;
		}
		return this.map.has(Object(mn.name));
	}

	public axDeleteProperty(mn: Multiname) {
		if (<any> this === this.axClass.dPrototype) {
			return super.axDeleteProperty(mn);
		}
		const key = Dictionary.makePrimitiveKey(mn.name);
		if (key !== undefined) {
			delete this.primitiveMap[<any>key];
			return;
		}

		const okey = Object(mn.name);

		if (!this.map.has(okey))
			return false;

		this.map.delete(okey);

		if (this.weakKeys) {
			this.keys.delete(this.refs.get(okey));
			this.refs.delete(okey);
		} else {
			this.keys.delete(okey);
		}

		return true;
	}

	axGetPublicProperty(nm: any): any {
		if (<any> this === this.axClass.dPrototype) {
			return super.axGetPublicProperty(nm);
		}
		const key = Dictionary.makePrimitiveKey(nm);
		if (key !== undefined) {
			return this.primitiveMap[<any>key];
		}
		return this.map.get(Object(nm));
	}

	public axGetEnumerableKeys(): any [] {
		if (<any> this === this.axClass.dPrototype) {
			return super.axGetEnumerableKeys();
		}
		const enumerableKeys = [];

		for (const k in this.primitiveMap)
			enumerableKeys.push(k);

		this.keys.forEach((value) => {
			const k = this.weakKeys ? value.deref() : value;
			if (k) {
				enumerableKeys.push(k);
			} else {
				this.keys.delete(value);
			}
		});

		return enumerableKeys;
	}
}