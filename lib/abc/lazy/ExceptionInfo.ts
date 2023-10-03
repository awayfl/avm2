import { Traits } from './Traits';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';
import { SlotTraitInfo } from './SlotTraitInfo';
import { TRAIT } from './TRAIT';

export class ExceptionInfo {
	public catchPrototype: Object = null;
	private _traits: Traits = null;
	constructor(
		public abc: ABCFile,
		public start: number,
		public end: number,
		public target: number,
		public multiname: Multiname,
		public type: Multiname
	) {
		// ...
	}

	getTraits(): Traits {
		if (!this._traits)
			this._traits = new Traits([new SlotTraitInfo(this.abc, TRAIT.Slot,this.multiname, 1, this.type, 0, 0)]);

		return this._traits;
	}
}