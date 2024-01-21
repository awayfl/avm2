import { SlotTraitInfo } from './SlotTraitInfo';
import { ABCFile } from './ABCFile';
import { TRAIT } from './TRAIT';
import { Multiname } from './Multiname';
import { ClassInfo } from './ClassInfo';

export class ClassTraitInfo extends SlotTraitInfo {
	constructor(
		abc: ABCFile,
		kind: TRAIT,
		multiname: Multiname,
		slot: number,
		public readonly classInfo: ClassInfo
	) {
		super(abc, kind, multiname, slot, abc.getMultiname(0), 0, -1);
	}
}