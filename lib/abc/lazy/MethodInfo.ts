import { MethodTraitInfo } from './MethodTraitInfo';
import { MethodBodyInfo } from './MethodBodyInfo';
import { AXClass } from '../../run/AXClass';
import { ABCFile } from './ABCFile';
import { ParameterInfo } from './ParameterInfo';
import { MetadataInfo } from './MetadataInfo';
import { TRAIT } from './TRAIT';
import { InstanceInfo } from './InstanceInfo';
import { ClassInfo } from './ClassInfo';
import { METHOD } from './METHOD';
import { Multiname } from './Multiname';
import { ScriptInfo } from './ScriptInfo';
import { COMPILATION_STATE, COMPILATION_FAIL_REASON } from '../../flags';
import { IMethodReadableMeta } from '../../utils/reconstructMetadata';

export class MethodInfo {
	public meta: IMethodReadableMeta;
	public parentInfo?: MethodInfo;

	public trait: MethodTraitInfo = null;
	public minArgs: number;

	private _body: MethodBodyInfo;
	private _returnType: AXClass;

	public scriptInfo: ScriptInfo = null;
	public classInfo: ClassInfo = null;
	public instanceInfo: InstanceInfo = null;
	public isConstructor: boolean = false;

	public compiled: Function = null;
	public names: Multiname[];
	public error: {message: string, reason: COMPILATION_FAIL_REASON} = null;
	public useCount: number = 0;

	public get state(): COMPILATION_STATE {
		if (this.error || this.getBody() == null) {
			return COMPILATION_STATE.FAILED;
		}

		if (this.compiled) {
			return COMPILATION_STATE.COMPILLED;
		}

		return COMPILATION_STATE.PENDING;
	}

	constructor(
		public abc: ABCFile,
		private _index: number,
		public readonly name: string,
		public readonly typeName: Multiname,
		public readonly parameters: ParameterInfo [],
		public readonly optionalCount: number,
		public readonly flags: number
	) {
		this._body = null;
		this.minArgs = parameters.length - optionalCount;
	}

	public getNativeMetadata(): MetadataInfo {
		const metadata = this.trait?.metadata;
		if (!metadata)
			return null;

		for (let i = 0; i < metadata.length; i++)
			if (metadata[i].name === 'native')
				return metadata[i];

		return null;
	}

	public getBody(): MethodBodyInfo {
		return this._body || (this._body = this.abc.getMethodBodyInfo(this._index));
	}

	public index(): number {
		return this._index;
	}

	getType(): AXClass {
		if (this._returnType !== undefined)
			return this._returnType;

		this._returnType = this.typeName? this.abc.applicationDomain.getClass(this.typeName) : null;

		return this._returnType;
	}

	toString() {
		let str = this.name;
		str += ' (' + this.parameters.join(', ') + ')';
		if (this.typeName) {
			str += ': ' + this.typeName.name;
		}
		return str;
	}

	toFlashlogString(): string {
		const trait = this.trait;
		let prefix = trait.kind === TRAIT.Getter ? 'get ' :
			trait.kind === TRAIT.Setter ? 'set ' : '';
		let name = trait.multiname.toFlashlogString();
		const holder = trait.holder;
		let holderName;
		if (holder && holder instanceof InstanceInfo) {
			holderName = (<InstanceInfo>holder).multiname.toFlashlogString();
			prefix = holderName + '/' + prefix;
		}
		if (holder && holder instanceof ClassInfo && (<ClassInfo>holder).trait) {
			holderName = (<ClassInfo>holder).trait.multiname.toFlashlogString();
			prefix = holderName + '$/' + prefix;
		}
		let prefixPos;
		if (holderName && (prefixPos = name.indexOf('::')) > 0 &&
          holderName.indexOf(name.substring(0, prefixPos + 2)) === 0) {
			name = name.substring(prefixPos + 2);
		}
		return 'MTHD ' + prefix + name + ' ()';
	}

	isNative(): boolean {
		return !!(this.flags & METHOD.Native);
	}

	needsRest(): boolean {
		return !!(this.flags & METHOD.NeedRest);
	}

	needsArguments(): boolean {
		return !!(this.flags & METHOD.NeedArguments);
	}
}