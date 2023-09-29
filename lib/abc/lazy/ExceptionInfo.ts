import { Traits } from './Traits';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';
import { SlotTraitInfo } from './SlotTraitInfo';
import { TRAIT } from './TRAIT';
import { TraitInfo } from './TraitInfo';

export class ExceptionInfo {
	public catchPrototype: Object = null;
	private _traits: Traits = null;
	constructor(
		public abc: ABCFile,
		public start: number,
		public end: number,
		public target: number,
		public type: Multiname | number,
		public varIndex: number
	) {
		// ...
	}

	getType(): Multiname {
		if (typeof this.type === 'number') {
			this.type = this.abc.getMultiname(<number> this.type);
		}
		return <Multiname> this.type;
	}

	getTraits(): Traits {
		if (!this._traits) {
			const traits: TraitInfo [] = [];
			if (this.varIndex) {
				traits.push(new SlotTraitInfo(this.abc, TRAIT.Slot,this.abc.getMultiname(this.varIndex), 1, this.type, 0, 0));
			}
			this._traits = new Traits(traits);
			this._traits.resolve();
		}
		return this._traits;
	}
}