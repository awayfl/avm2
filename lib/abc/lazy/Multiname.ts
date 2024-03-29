import { ABCFile } from './ABCFile';
import { CONSTANT, getCONSTANTName } from './CONSTANT';
import { Namespace } from './Namespace';
import { NamespaceType } from './NamespaceType';
import { internNamespace } from './internNamespace';
import { release } from '@awayfl/swf-loader';
import { assert } from '@awayjs/graphics';
import { internPrefixedNamespace } from './internPrefixedNamespace';
import { axCoerceString } from '../../run/axCoerceString';
import { isNumeric } from '@awayfl/swf-loader';
import { AXObject } from '../../run/AXObject';
import { Settings } from '../../Settings';
import { IGlobalInfo } from './IGlobalInfo';

export class Multiname {
	private static _isWeak = self.WeakRef && Settings.USE_WEAK_REF;
	private static _nextID = 1;
	public id: number = Multiname._nextID++;
	private _mangledName: string = null;

	public globalInfo: IGlobalInfo = null;
	public numeric: boolean = false;
	public numericValue: any = 0;
	public resolved: object = {};

	private _scope: AXObject | WeakRef<AXObject> = null;
	private _value: AXObject | WeakRef<AXObject> = null;
	private _key: string = null;

	constructor(
		public abc: ABCFile,
		public index: number,
		public kind: CONSTANT,
		public namespaces: Namespace [],
		public name: any,
		public parameterType: Multiname = null,
		public mutable: boolean = false
	) {
		// ...
	}

	public set(name: string | number | any, namespace?: Namespace) {
		// try to cast name to numeric, required for objects with numeric key's
		// {0: 1}
		const isIndexator = (
			typeof name === 'number'
			|| (
				typeof name === 'string' // name maybe as object for Map
				&& !name.includes('.') // check case when name is `1.0`
				&& Number.isInteger(+name) // check that real integer, same as isFinite
			)
		);

		if (typeof name === 'object') {
			//debugger;
		}

		this.namespaces = namespace ? [namespace] : [];
		this.name = name;

		this.numeric = false;
		if (isIndexator) {
			this.numericValue = +name;
			this.numeric = true;
		}
	}

	/**
	 * Drop field for RT name
	 * @see https://github.com/awayfl/avm2/issues/4
	 */
	public drop() {
		if (!this.mutable || !this.isRuntimeName) {
			// throw "DROP allowed only foe runtime name";
			return;
		}

		this.numeric = false;
		this.name = undefined;
		this.namespaces = [];
		this.numericValue = NaN;
		this.resolved = {};

		this._scope = null;
	}

	public get scope(): AXObject {
		return (!this._scope || !Multiname._isWeak)
			? <AXObject> this._scope
			: (<WeakRef<AXObject>> this._scope).deref();
	}

	public set scope(v: AXObject) {
		if (Multiname._isWeak && v) {
			this._scope = new self.WeakRef<AXObject>(v);
			return;
		}
		this._scope = v;
	}

	public get value(): AXObject {
		return (!this._value || !Multiname._isWeak)
			? <AXObject> this._value
			: (<WeakRef<AXObject>> this._value).deref();
	}

	public set value(v: AXObject) {
		if (Multiname._isWeak && v) {
			this._value = new self.WeakRef<AXObject>(v);
			return;
		}

		this._value = v;
	}

	public key(): string {
		if (this._key)
			return this._key;

		const r = this.toString();

		if (!this.mutable)
			this._key = r;

		return r;
	}

	public static FromFQNString(fqn: string, nsType: NamespaceType) {
		const lastDot = fqn.lastIndexOf('.');
		const uri = lastDot === -1 ? '' : fqn.substr(0, lastDot);
		const name = lastDot === -1 ? fqn : fqn.substr(lastDot + 1);
		const ns = internNamespace(nsType, uri);
		return new Multiname(null, 0, CONSTANT.RTQName, [ns], name);
	}

	private _nameToString(): string {
		if (this.isAnyName()) {
			return '*';
		}
		return this.isRuntimeName() ? '[' + this.name + ']' : this.name;
	}

	public isRuntime(): boolean {
		switch (this.kind) {
			case CONSTANT.QName:
			case CONSTANT.QNameA:
			case CONSTANT.Multiname:
			case CONSTANT.MultinameA:
				return false;
		}
		return true;
	}

	public isRuntimeName(): boolean {
		switch (this.kind) {
			case CONSTANT.RTQNameL:
			case CONSTANT.RTQNameLA:
			case CONSTANT.MultinameL:
			case CONSTANT.MultinameLA:
				return true;
		}
		return false;
	}

	public isRuntimeNamespace(): boolean {
		/*
		switch (this.kind) {
			case CONSTANT.RTQName:
			case CONSTANT.RTQNameA:
			case CONSTANT.RTQNameL:
			case CONSTANT.RTQNameLA:
				return true;
		}*/

		return this.kind >= CONSTANT.RTQName && this.kind <= CONSTANT.RTQNameLA;
	}

	public isAnyName(): boolean {
		return this.name === null;
	}

	public isAnyNamespace(): boolean {
		if (this.isRuntimeNamespace() || this.namespaces.length > 1) {
			return false;
		}
		return this.namespaces.length === 0 || this.namespaces[0].uri === '';

		// x.* has the same meaning as x.*::*, so look for the former case and give
		// it the same meaning of the latter.
		// return !this.isRuntimeNamespace() &&
		//  (this.namespaces.length === 0 || (this.isAnyName() && this.namespaces.length !== 1));
	}

	public isQName(): boolean {
		const kind = this.kind;
		const result = kind === CONSTANT.TypeName ||
                    kind === CONSTANT.QName || kind === CONSTANT.QNameA ||
                    kind >= CONSTANT.RTQName && kind <= CONSTANT.RTQNameLA;
		release || assert(!(result && this.namespaces.length !== 1));
		return result;
	}

	public get namespace(): Namespace {
		release || assert(this.isQName());
		return this.namespaces[0];
	}

	public get uri(): string {
		release || assert(this.isQName());
		return this.namespaces[0].uri;
	}

	public get prefix(): string {
		release || assert(this.isQName());
		return this.namespaces[0].prefix;
	}

	public set prefix(prefix: string) {
		release || assert(this.isQName());
		const ns = this.namespaces[0];
		if (ns.prefix === prefix) {
			return;
		}
		this.namespaces[0] = internPrefixedNamespace(ns.type, ns.uri, prefix);
	}

	public equalsQName(mn: Multiname): boolean {
		release || assert(this.isQName());
		return this.name === mn.name && this.namespaces[0].uri === mn.namespaces[0].uri;
	}

	public matches(mn: Multiname): boolean {
		release || assert(this.isQName());
		const anyName = mn.isAnyName();
		if (anyName && !mn.isQName()) {
			return true;
		}
		if (!anyName && this.name !== mn.name) {
			return false;
		}

		const uri = this.namespaces[0].uri;

		// @todo: not sure about this.
		// seems like its needed to match for xml nodes that have uri==""
		if (uri == '' || uri == 'default')
			return true;

		for (let i = mn.namespaces.length; i--;) {
			// @todo: not sure about this. needed for xml
			if (mn.namespaces[i].uri == '' || mn.namespaces[i].uri === uri) {
				return true;
			}
		}
		return false;
	}

	public isAttribute(): boolean {
		switch (this.kind) {
			case CONSTANT.QNameA:
			case CONSTANT.RTQNameA:
			case CONSTANT.RTQNameLA:
			case CONSTANT.MultinameA:
			// Why? I not found a reason for L, in any cases is only A is figured
			//case CONSTANT.MultinameL:
			// eslint-disable-next-line no-fallthrough
			case CONSTANT.MultinameLA:
				return true;
		}
		return false;
	}

	public getMangledName(): string {
		release || assert(this.isQName());
		return this._mangledName || this._mangleName();
	}

	private _mangleName() {
		release || assert(!this._mangledName);
		const mangledName = '$Bg' + axCoerceString(this.name);
		if (!this.isRuntime()) {
			this._mangledName = mangledName;
		}
		return mangledName;
	}

	public getPublicMangledName(): any {
		if (isNumeric(this.name)) {
			return this.name;
		}
		return '$Bg' + axCoerceString(this.name);
	}

	public static isPublicQualifiedName(value: any): boolean {
		return value.indexOf('$Bg') === 0;
	}

	public static getPublicMangledName(name: string): any {
		if (isNumeric(name)) {
			return name;
		}
		return '$Bg' + name;
	}

	public toFQNString(useColons: boolean) {
		release || assert(this.isQName());
		let prefix = this.namespaces[0].uri;
		if (prefix.length) {
			prefix += (useColons ? '::' : '.');
		}
		return prefix + this.name;
	}

	public toString() {
		let str = getCONSTANTName(this.kind) + ' ';
		str += this.isAttribute() ? '@' : '';
		if (this.isRuntimeNamespace()) {
			const namespaces = this.namespaces ? this.namespaces.map(x => String(x)).join(', ') : null;
			str += '[' + namespaces + ']::' + this._nameToString();
		} else if (this.isQName()) {
			str += this.namespaces[0] + '::';
			str += this._nameToString();
		} else if (this.namespaces) {
			str += '{' + this.namespaces.map(x => String(x)).join(', ') + '}';
			str += '::' + this._nameToString();
		} else {
			str += '{' + this.namespaces + '}';
			str += '::' + this._nameToString();
		}
		if (this.parameterType) {
			str += '<' + this.parameterType + '>';
		}
		return str;
	}

	public toFlashlogString(): string {
		const namespaceUri = this.uri;
		return namespaceUri ? namespaceUri + '::' + this.name : this.name;
	}

	/**
     * Removes the public prefix, or returns undefined if the prefix doesn't exist.
     */
	public static stripPublicMangledName(name: string): any {
		if (name.indexOf('$Bg') === 0) {
			return name.substring(3);
		}
		return undefined;
	}

	public static FromSimpleName(simpleName: string | any): Multiname {

		let realName = '';

		//	hack when simple-name is a XMLList returned from "attribute" getter
		//	when working with xml

		if (typeof simpleName !== 'string' && simpleName._children?.length === 1) {
			simpleName = (<any>simpleName)._children[0]._value || '';
		} else {
			realName = simpleName;
		}

		//case for `com.package.name::className`
		let nameIndex = realName.lastIndexOf('::');

		if (nameIndex > 0) {
			// trim extra :
			realName = realName.replace('::', ':');
		} else {
			//case for `com.package.name.className`
			nameIndex = realName.lastIndexOf('.');
		}

		if (nameIndex <= 0) {
			// todo Fix multiname resolver for simple name
			// case for `com.package.name className`
			// bugged on BBR, game has sounds named as 'bison 8-bit', 'bison victory'
			//nameIndex = realName.lastIndexOf(' ');
		}

		let uri = '';
		let name = realName;

		if (nameIndex > 0 && nameIndex < realName.length - 1) {
			name = realName.substring(nameIndex + 1).trim();
			uri = realName.substring(0, nameIndex).trim();
		}

		const ns = internNamespace(NamespaceType.Public, uri);
		return new Multiname(null, 0, CONSTANT.RTQName, [ns], name);
	}
}