import { TraitInfo } from './TraitInfo';
import { ABCFile } from './ABCFile';
import { TRAIT } from './TRAIT';
import { Multiname } from './Multiname';
import { CONSTANT } from './CONSTANT';
import { typeDefaultValues } from './typeDefaultValues';

export class SlotTraitInfo extends TraitInfo {
	constructor(
		abc: ABCFile,
		kind: TRAIT,
		multiname: Multiname,
		public slot: number,
		public typeName: Multiname,
		public defaultValueKind: CONSTANT,
		public defaultValueIndex: number
	) {
		super(abc, kind, multiname);
		if (typeName == undefined && <number> this.defaultValueKind === -1) {
			console.log('undefined');
		}
	}

	getDefaultValue(): any {
		if (<number> this.defaultValueKind === -1) {
			if (this.typeName === null) {
				return undefined;
			}
			const value = typeDefaultValues[(<Multiname> this.typeName).getMangledName()];
			return value === undefined ? null : value;
		}
		return this.abc.getConstant(this.defaultValueKind, this.defaultValueIndex);
	}
}