import { Multiname } from './Multiname';
import { AXClass } from '../../run/AXClass';
import { TRAIT } from './TRAIT';
import { ABCFile } from './ABCFile';

export class RuntimeTraitInfo {
	configurable: boolean = true; // Always true.
	enumerable: boolean; // Always false.
	writable: boolean;
	get: () => any;
	set: (v: any) => void;
	slot: number;
	value: any;
	public typeName: Multiname = null;

	private _type: AXClass = undefined;

	constructor(
		public multiname: Multiname,
		public kind: TRAIT,
		private _abc: ABCFile
	) {}

	getType(): AXClass {
		if (this._type !== undefined) 
			return this._type;

		if (this.typeName === null)
			return this._type = null;

		const type = this._abc.applicationDomain.getClass(this.typeName);
		return this._type = (type && type.axCoerce) ? type : null;
	}
}