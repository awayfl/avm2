import { AXApplicationDomain } from '../../run/AXApplicationDomain';
import { assert } from '@awayjs/graphics';
import { release, unexpected, warning } from '@awayfl/swf-loader';
import { Namespace } from './Namespace';
import { Multiname } from './Multiname';
import { MetadataInfo } from './MetadataInfo';
import { MethodInfo } from './MethodInfo';
import { MethodBodyInfo } from './MethodBodyInfo';
import { ClassInfo } from './ClassInfo';
import { ScriptInfo } from './ScriptInfo';
import { InstanceInfo } from './InstanceInfo';
import { CONSTANT } from './CONSTANT';
import { Errors } from '../../errors';
import { NamespaceType } from './NamespaceType';
import { internNamespace } from './internNamespace';
import { METHOD } from './METHOD';
import { ParameterInfo } from './ParameterInfo';
import { Traits } from './Traits';
import { TraitInfo } from './TraitInfo';
import { TRAIT } from './TRAIT';
import { SlotTraitInfo } from './SlotTraitInfo';
import { MethodTraitInfo } from './MethodTraitInfo';
import { ClassTraitInfo } from './ClassTraitInfo';
import { ATTR } from './ATTR';
import { ExceptionInfo } from './ExceptionInfo';
import { IndentingWriter } from '@awayfl/swf-loader';
import { AbcStream } from '../stream';

export class ABCFile {
	public ints: Int32Array;
	public uints: Uint32Array;
	public doubles: Float64Array;

	/**
     * Environment this ABC is loaded into.
     * In the shell, this is just a wrapper around an applicationDomain, but in the
     * SWF player, it's a flash.display.LoaderInfo object.
     */
	public env: {app: AXApplicationDomain; url: string};

	public get applicationDomain() {
		release || assert(this.env.app);
		return this.env.app;
	}

	private _stream: AbcStream;

	private _strings: string [];

	private _namespaces: Namespace [];

	private _namespaceSets: Namespace [][];

	private _multinames: Multiname [];

	private _metadata: MetadataInfo [];

	private _methods: MethodInfo [];
	private _methodBodies: MethodBodyInfo [];

	public classes: ClassInfo [];
	public scripts: ScriptInfo [];
	public instances: InstanceInfo [];

	constructor(
		env: {app: AXApplicationDomain; url: string},
		private _buffer: Uint8Array
	) {
		this.env = env;
		this._stream = new AbcStream(_buffer);
		this._checkMagic();

		this._parseConstantPool();
		this._parseNamespaces();
		this._parseNamespaceSets();
		this._parseMultinames();

		this._parseMethodInfos();
		this._parseMetaData();
		this._parseInstanceAndClassInfos();
		this._parseScriptInfos();
		this._parseMethodBodyInfos();
	}

	private _parseConstantPool() {
		this._parseNumericConstants();
		this._parseStringConstants();
	}

	private _parseNumericConstants() {
		const s = this._stream;

		// Parse Signed Integers
		let n = s.readU30();
		const ints = new Int32Array(n);
		ints[0] = 0;
		for (let i = 1; i < n; i++) {
			ints[i] = s.readS32();
		}
		this.ints = ints;

		// Parse Unsigned Integers
		n = s.readU30();
		const uints = new Uint32Array(n);
		uints[0] = 0;
		for (let i = 1; i < n; i++) {
			uints[i] = s.readS32();
		}
		this.uints = uints;

		// Parse Doubles
		n = s.readU30();
		const doubles = new Float64Array(n);
		doubles[0] = NaN;
		for (let i = 1; i < n; i++) {
			doubles[i] = s.readDouble();
		}
		this.doubles = doubles;
	}

	private _parseStringConstants() {
		const s = this._stream;
		const n = s.readU30();
		this._strings = new Array(n);
		this._strings[0] = null;

		// Record the offset of each string in |stringOffsets|. This array has one extra
		// element so that we can compute the length of the last string.
		for (let i = 1; i < n; i++) {
			const l = s.readU30();
			this._strings[i] = s.readUTFString(l);
		}
	}

	private _parseNamespaces() {
		const s = this._stream;
		const n = s.readU30();
		this._namespaces = new Array(n);
		for (let i = 1; i < n; i++) {
			const kind = s.readU8();
			const uriIndex = s.readU30();
			let uri = uriIndex ? this.getString(uriIndex) : undefined;
			let type: NamespaceType;
			switch (kind) {
				case CONSTANT.Namespace:
				case CONSTANT.PackageNamespace:
					type = NamespaceType.Public;
					break;
				case CONSTANT.PackageInternalNs:
					type = NamespaceType.PackageInternal;
					break;
				case CONSTANT.ProtectedNamespace:
					type = NamespaceType.Protected;
					break;
				case CONSTANT.ExplicitNamespace:
					type = NamespaceType.Explicit;
					break;
				case CONSTANT.StaticProtectedNs:
					type = NamespaceType.StaticProtected;
					break;
				case CONSTANT.PrivateNs:
					type = NamespaceType.Private;
					break;
				default:
					this.applicationDomain.sec.throwError('VerifierError',
						Errors.CpoolEntryWrongTypeError, i);
			}
			if (uri && type !== NamespaceType.Private) {
				// TODO: deal with API versions here. Those are suffixed to the uri. We used to
				// just strip them out, but we also had an assert against them occurring at all,
				// so it might be the case that we don't even need to do anything at all.
			} else if (uri === undefined) {
				// Only private namespaces gets the empty string instead of undefined. A comment
				// in Tamarin source code indicates this might not be intentional, but oh well.
				uri = '';
			}
			this._namespaces[i] = internNamespace(type, uri);
		}
	}

	private _parseNamespaceSets() {
		const s = this._stream;
		const n = s.readU30();
		this._namespaceSets = new Array(n);
		this._namespaceSets[0] = null;
		for (let i = 1; i < n; i++) {
			const c = s.readU30(); // Count
			const nss = this._namespaceSets[i] = new Array(c);
			for (let j = 0; j < c; j++) {
				const x = s.readU30();
				nss[j] = this.getNamespace(x);
			}
		}
	}

	private _parseMultinames() {
		const s = this._stream;
		const n = s.readU30();
		this._multinames = new Array(n);
		this._multinames[0] = null;
		for (let i = 1; i < n; i++) {
			this._multinames[i] = this._parseMultiname(i);
		}
	}

	private _parseMultiname(i: number): Multiname {
		const stream = this._stream;

		let namespaceIsRuntime = false;
		let namespaceIndex;
		let useNamespaceSet = true;
		let nameIndex = 0;

		const kind = stream.readU8();
		switch (kind) {
			case CONSTANT.QName:
			case CONSTANT.QNameA:
				namespaceIndex = stream.readU30();
				useNamespaceSet = false;
				nameIndex = stream.readU30();
				break;
			case CONSTANT.RTQName: case CONSTANT.RTQNameA:
				namespaceIsRuntime = true;
				nameIndex = stream.readU30();
				break;
			case CONSTANT.RTQNameL: case CONSTANT.RTQNameLA:
				namespaceIsRuntime = true;
				break;
			case CONSTANT.Multiname: case CONSTANT.MultinameA:
				nameIndex = stream.readU30();
				namespaceIndex = stream.readU30();
				break;
			case CONSTANT.MultinameL: case CONSTANT.MultinameLA:
				namespaceIndex = stream.readU30();
				if (!release && namespaceIndex === 0) {
					// TODO: figure out what to do in this case. What would Tamarin do?
					warning('Invalid multiname: namespace-set index is 0');
				}
				break;
				/**
         * This is undocumented, looking at Tamarin source for this one.
         */
			case CONSTANT.TypeName: {
				const nameIndex = stream.readU32();
				const typeParameterCount = stream.readU32();
				if (!release && typeParameterCount !== 1) {
					// TODO: figure out what to do in this case. What would Tamarin do?
					warning('Invalid multiname: bad type parameter count ' + typeParameterCount);
				}
				const typeParameter = this._multinames[stream.readU32()];
				const factory = this._multinames[nameIndex];
				return new Multiname(this, i, kind, factory.namespaces, factory.name, typeParameter);
			}
			default:
				unexpected();
				break;
		}

		// A name index of 0 means that it's a runtime name.
		const name = nameIndex === 0 ? null : this.getString(nameIndex);
		let namespaces;
		if (namespaceIsRuntime) {
			namespaces = null;
		} else {
			namespaces = useNamespaceSet ?
				this._namespaceSets[namespaceIndex] :
				[this.getNamespace(namespaceIndex)];
		}

		return new Multiname(this, i, kind, namespaces, name);
	}

	private _checkMagic() {
		const magic = this._stream.readWord();
		const flashPlayerBrannan = 46 << 16 | 15;
		if (magic < flashPlayerBrannan) {
			this.env.app.sec.throwError('VerifierError', Errors.InvalidMagicError, magic >> 16,
				magic & 0xffff);
		}
	}

	/**
     * String duplicates exist in practice but are extremely rare.
     */
	private _checkForDuplicateStrings(): boolean {
		const a = [];
		for (let i = 0; i < this._strings.length; i++) {
			a.push(this.getString(i));
		}
		a.sort();
		for (let i = 0; i < a.length - 1; i++) {
			if (a[i] === a[i + 1]) {
				return true;
			}
		}
		return false;
	}

	/**
     * Returns the string at the specified index in the string table.
     */
	public getString(i: number): string {
		release || assert(i >= 0 && i < this._strings.length);
		return this._strings[i];
	}

	/**
     * Returns the multiname at the specified index in the multiname table.
     */
	public getMultiname(i: number): Multiname {
		if (i < 0 || i >= this._multinames.length) {
			this.applicationDomain.sec.throwError('VerifierError',
				Errors.CpoolIndexRangeError, i,
				this._multinames.length);
		}
		if (i === 0) {
			return null;
		}
		return this._multinames[i];
	}

	/**
     * Returns the namespace at the specified index in the namespace table.
     */
	public getNamespace(i: number): Namespace {
		if (i < 0 || i >= this._namespaces.length) {
			this.applicationDomain.sec.throwError('VerifierError', Errors.CpoolIndexRangeError, i,
				this._namespaces.length);
		}
		if (i === 0) {
			return Namespace.PUBLIC;
		}
		return this._namespaces[i];
	}

	/**
     * Returns the namespace set at the specified index in the namespace set table.
     */
	public getNamespaceSet(i: number): Namespace [] {
		if (i < 0 || i >= this._namespaceSets.length) {
			this.applicationDomain.sec.throwError('VerifierError', Errors.CpoolIndexRangeError, i,
				this._namespaceSets.length);
		}
		if (i === 0) {
			return null;
		}
		return this._namespaceSets[i];
	}

	private _parseMethodInfos() {
		const s = this._stream;
		const n = s.readU30();
		this._methods = new Array(n);
		for (let i = 0; i < n; ++i) {
			this._methods[i] = this._parseMethodInfo(i);
		}
	}

	private _parseMethodInfo(j: number) {
		const s = this._stream;
		const parameterCount = s.readU30();
		const returnType = s.readU30();
		const parameters = new Array<ParameterInfo>(parameterCount);
		for (let i = 0; i < parameterCount; i++) {
			parameters[i] = new ParameterInfo(this, s.readU30(), 0, -1, -1);
		}
		const name = s.readU30();
		const flags = s.readU8();
		let optionalCount = 0;
		if (flags & METHOD.HasOptional) {
			optionalCount = s.readU30();
			release || assert(parameterCount >= optionalCount);
			for (let i = parameterCount - optionalCount; i < parameterCount; i++) {
				parameters[i].optionalValueIndex = s.readU30();
				parameters[i].optionalValueKind = s.readU8();
			}
		}
		if (flags & METHOD.HasParamNames) {
			for (let i = 0; i < parameterCount; i++) {
				// NOTE: We can't get the parameter name as described in the spec because some SWFs have
				// invalid parameter names. Tamarin ignores parameter names and so do we.
				parameters[i].name = s.readU30();
			}
		}
		return new MethodInfo(this, j, name, returnType, parameters, optionalCount, flags);
	}

	/**
     * Returns the method info at the specified index in the method info table.
     */
	public getMethodInfo(i: number) {
		release || assert(i >= 0 && i < this._methods.length);
		return this._methods[i];
	}

	public getMethodBodyInfo(i: number) {
		return this._methodBodies[i];
	}

	private _parseMetaData() {
		const s = this._stream;
		const n = s.readU30();
		this._metadata = new Array(n);
		for (let i = 0; i < n; i++) {
			const name = s.readU30(); // Name
			const itemCount = s.readU30(); // Item Count
			const keys = new Uint32Array(itemCount);
			for (let j = 0; j < itemCount; j++) {
				keys[j] = s.readU30();
			}
			const values = new Uint32Array(itemCount);
			for (let j = 0; j < itemCount; j++) {
				values[j] = s.readU30();
			}
			this._metadata[i] = new MetadataInfo(this, name, keys, values);
		}
	}

	public getMetadataInfo(i: number): MetadataInfo {
		release || assert(i >= 0 && i < this._metadata.length);
		return this._metadata[i];
	}

	private _parseInstanceAndClassInfos() {
		const s = this._stream;
		const n = s.readU30();
		const instances = this.instances = new Array(n);
		for (let i = 0; i < n; i++) {
			instances[i] = this._parseInstanceInfo();
		}
		this._parseClassInfos(n);
		const o = s.position;
		for (let i = 0; i < n; i++) {
			instances[i].classInfo = this.classes[i];
		}
		s.seek(o);
	}

	private _parseInstanceInfo(): InstanceInfo {
		const s = this._stream;
		const name = s.readU30();
		const superName = s.readU30();
		const flags = s.readU8();
		let protectedNsIndex = 0;
		if (flags & CONSTANT.ClassProtectedNs) {
			protectedNsIndex = s.readU30();
		}
		const interfaceCount = s.readU30();
		const interfaces = [];
		for (let i = 0; i < interfaceCount; i++) {
			interfaces[i] = s.readU30();
		}
		const initializer = s.readU30();
		const traits = this._parseTraits();
		const instanceInfo = new InstanceInfo(this, name, superName, flags, protectedNsIndex,
			interfaces, initializer, traits);
		traits.attachHolder(instanceInfo);
		return instanceInfo;
	}

	private _parseTraits() {
		const s = this._stream;
		const n = s.readU30();
		const traits = [];
		for (let i = 0; i < n; i++) {
			traits.push(this._parseTrait());
		}
		return new Traits(traits);
	}

	private _parseTrait() {
		const s = this._stream;
		const multiname = this._multinames[s.readU30()];
		const tag = s.readU8();

		const kind = tag & 0x0F;
		const attributes = (tag >> 4) & 0x0F;

		let trait: TraitInfo;
		switch (kind) {
			case TRAIT.Slot:
			case TRAIT.Const: {
				const slot = s.readU30();
				const typeName = this._multinames[s.readU30()];
				const valueIndex = s.readU30();
				let valueKind = -1;
				if (valueIndex !== 0) {
					valueKind = s.readU8();
				}
				trait = new SlotTraitInfo(this, kind, multiname, slot, typeName, valueKind, valueIndex);
				break;
			}
			case TRAIT.Method:
			case TRAIT.Getter:
			case TRAIT.Setter: {
				s.readU30(); // Tamarin optimization.
				const methodInfo = this._methods[s.readU30()];
				trait = methodInfo.trait = new MethodTraitInfo(this, kind, multiname, methodInfo);
				break;
			}
			case TRAIT.Class: {
				const slot = s.readU30();
				const classInfo = this.classes[s.readU30()];
				trait = classInfo.trait = new ClassTraitInfo(this, kind, multiname, slot, classInfo);
				break;
			}
			default:
				this.applicationDomain.sec.throwError('VerifierError',
					Errors.UnsupportedTraitsKindError, kind);
		}

		if (attributes & ATTR.Metadata) {
			const n = s.readU30();
			const metadata = new Uint32Array(n);
			for (let i = 0; i < n; i++) {
				metadata[i] = s.readU30();
			}
			trait.metadata = metadata;
		}
		return trait;
	}

	private _parseClassInfos(n: number) {
		const classes = this.classes = new Array(n);
		for (let i = 0; i < n; i++) {
			classes[i] = this._parseClassInfo(i);
		}
	}

	private _parseClassInfo(i: number) {
		const initializer = this._stream.readU30();
		const traits = this._parseTraits();
		const classInfo = new ClassInfo(this, this.instances[i], initializer, traits);
		traits.attachHolder(classInfo);
		return classInfo;
	}

	private _parseScriptInfos() {
		const n = this._stream.readU30();
		const scripts = this.scripts = new Array(n);
		for (let i = 0; i < n; i++) {
			scripts[i] = this._parseScriptInfo();
		}
	}

	private _parseScriptInfo() {
		const initializer = this._stream.readU30();
		const traits = this._parseTraits();
		const scriptInfo = new ScriptInfo(this, initializer, traits);
		traits.attachHolder(scriptInfo);
		return scriptInfo;
	}

	private _parseMethodBodyInfos() {
		const s = this._stream;
		const methodBodies = this._methodBodies = new Array(this._methods.length);
		const n = s.readU30();
		for (let i = 0; i < n; i++) {
			const methodInfo = s.readU30();
			const maxStack = s.readU30();
			const localCount = s.readU30();
			const initScopeDepth = s.readU30();
			const maxScopeDepth = s.readU30();
			const code = s.viewU8s(s.readU30());

			const e = s.readU30();
			const exceptions = new Array(e);
			for (let j = 0; j < e; ++j) {
				exceptions[j] = this._parseException();
			}
			const traits = this._parseTraits();
			methodBodies[methodInfo] = new MethodBodyInfo(maxStack, localCount, initScopeDepth, maxScopeDepth, code, exceptions, traits);
			traits.attachHolder(methodBodies[methodInfo]);
		}
	}

	private _parseException() {
		const s = this._stream;
		const start = s.readU30();
		const end = s.readU30();
		const target = s.readU30();
		const typeIndex = s.readU30();
		const nameIndex = s.readU30();
		return new ExceptionInfo(this, start, end, target, this._multinames[nameIndex], this._multinames[typeIndex]);
	}

	public getConstant(kind: CONSTANT, i: number): any {
		switch (kind) {
			case CONSTANT.Int:
				return this.ints[i];
			case CONSTANT.UInt:
				return this.uints[i];
			case CONSTANT.Double:
				return this.doubles[i];
			case CONSTANT.Utf8:
				return this.getString(i);
			case CONSTANT.True:
				return true;
			case CONSTANT.False:
				return false;
			case CONSTANT.Null:
				return null;
			case CONSTANT.Undefined:
				return undefined;
			case CONSTANT.Namespace:
			case CONSTANT.PackageInternalNs:
				return this.getNamespace(i);
			case CONSTANT.QName:
			case CONSTANT.MultinameA:
			case CONSTANT.RTQName:
			case CONSTANT.RTQNameA:
			case CONSTANT.RTQNameL:
			case CONSTANT.RTQNameLA:
			case CONSTANT.NameL:
			case CONSTANT.NameLA:
				return this._multinames[i];
			case CONSTANT.Float:
				warning('TODO: CONSTANT.Float may be deprecated?');
				break;
			default:
				release || assert(false, 'Not Implemented Kind ' + kind);
		}
	}

	stress() {
		for (let i = 0; i < this._multinames.length; i++)
			this._multinames[i];

		for (let i = 0; i < this._namespaceSets.length; i++)
			this._namespaceSets[i];

		for (let i = 0; i < this._namespaces.length; i++)
			this.getNamespace(i);

		for (let i = 0; i < this._strings.length; i++)
			this.getString(i);

	}

	trace(writer: IndentingWriter) {
		writer.writeLn('Multinames: ' + this._multinames.length);

		writer.indent();
		for (let i = 0; i < this._multinames.length; i++) {
			writer.writeLn(i + ' ' + this._multinames[i]);
		}
		writer.outdent();

		writer.writeLn('Namespace Sets: ' + this._namespaceSets.length);

		writer.indent();
		for (let i = 0; i < this._namespaceSets.length; i++) {
			writer.writeLn(i + ' ' + this._multinames[i]);
		}
		writer.outdent();

		writer.writeLn('Namespaces: ' + this._namespaces.length);

		writer.indent();
		for (let i = 0; i < this._namespaces.length; i++) {
			writer.writeLn(i + ' ' + this.getNamespace(i));
		}
		writer.outdent();

		writer.writeLn('Strings: ' + this._strings.length);

		writer.indent();
		for (let i = 0; i < this._strings.length; i++) {
			writer.writeLn(i + ' ' + this.getString(i));
		}
		writer.outdent();

		writer.writeLn('MethodInfos: ' + this._methods.length);

		writer.indent();
		for (let i = 0; i < this._methods.length; i++) {
			writer.writeLn(i + ' ' + this.getMethodInfo(i));
			if (this._methodBodies[i]) {
				this._methodBodies[i].trace(writer);
			}
		}
		writer.outdent();

		writer.writeLn('InstanceInfos: ' + this.instances.length);

		writer.indent();
		for (let i = 0; i < this.instances.length; i++) {
			writer.writeLn(i + ' ' + this.instances[i]);
			this.instances[i].trace(writer);
		}
		writer.outdent();

		writer.writeLn('ClassInfos: ' + this.classes.length);

		writer.indent();
		for (let i = 0; i < this.classes.length; i++) {
			this.classes[i].trace(writer);
		}
		writer.outdent();

		writer.writeLn('ScriptInfos: ' + this.scripts.length);

		writer.indent();
		for (let i = 0; i < this.scripts.length; i++) {
			this.scripts[i].trace(writer);
		}
		writer.outdent();
	}
}