import { TraitInfo } from './TraitInfo';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';
import { TRAIT } from './TRAIT';
import { MethodInfo } from './MethodInfo';

export class MethodTraitInfo extends TraitInfo {
	public method: Function = null;
	constructor(
		public abc: ABCFile,
		public kind: TRAIT,
		public multiname: Multiname,
		public methodInfo: MethodInfo
	) {
		super(abc, kind, multiname);
	}
}
