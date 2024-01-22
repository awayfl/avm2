import { TRAIT, getTRAITName } from './TRAIT';
import { MetadataInfo } from './MetadataInfo';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';
import { ILocalInfo } from './ILocalInfo';

export class TraitInfo {
	public holder: ILocalInfo;
	public metadata: MetadataInfo [];

	constructor(
		public readonly abc: ABCFile,
		public readonly kind: TRAIT,
		public readonly multiname: Multiname
	) {}

	public toString() {
		return getTRAITName(this.kind) + ' ' + this.multiname;
	}

	public isConst(): boolean {
		return this.kind === TRAIT.Const;
	}

	public isSlot(): boolean {
		return this.kind === TRAIT.Slot;
	}

	public isMethod(): boolean {
		return this.kind === TRAIT.Method;
	}

	public isGetter(): boolean {
		return this.kind === TRAIT.Getter;
	}

	public isSetter(): boolean {
		return this.kind === TRAIT.Setter;
	}

	public isAccessor(): boolean {
		return this.kind === TRAIT.Getter || this.kind === TRAIT.Setter;
	}

	public isMethodOrAccessor(): boolean {
		return this.isAccessor() || this.kind === TRAIT.Method;
	}
}
