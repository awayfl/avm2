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

	getMetadata(): MetadataInfo [] {
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

	toString() {
		return getTRAITName(this.kind) + ' ' + this.multiname;
	}

	toFlashlogString(): string {
		return this.multiname.toFlashlogString();
	}

	isConst(): boolean {
		return this.kind === TRAIT.Const;
	}

	isSlot(): boolean {
		return this.kind === TRAIT.Slot;
	}

	isMethod(): boolean {
		return this.kind === TRAIT.Method;
	}

	isGetter(): boolean {
		return this.kind === TRAIT.Getter;
	}

	isSetter(): boolean {
		return this.kind === TRAIT.Setter;
	}

	isAccessor(): boolean {
		return this.kind === TRAIT.Getter ||
              this.kind === TRAIT.Setter;
	}

	isMethodOrAccessor(): boolean {
		return this.isAccessor() || this.kind === TRAIT.Method;
	}
}
