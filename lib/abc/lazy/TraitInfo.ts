import { TRAIT, getTRAITName } from './TRAIT';
import { Info } from './Info';
import { MetadataInfo } from './MetadataInfo';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';

export class TraitInfo {
	public holder: Info;
	public metadata: MetadataInfo [] | Uint32Array;

	constructor(
		public abc: ABCFile,
		public kind: TRAIT,
		public multiname: Multiname
	) {
		this.metadata = null;
		this.holder = null;
	}

	public getMetadata(): MetadataInfo [] {
		if (!this.metadata) {
			return null;
		}
		if (this.metadata instanceof Uint32Array) {
			const metadata = new Array(this.metadata.length);
			for (let i = 0; i < this.metadata.length; i++) {
				metadata[i] = this.abc.getMetadataInfo(<number> this.metadata[i]);
			}
			this.metadata = metadata;
		}
		return <MetadataInfo []> this.metadata;
	}

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
