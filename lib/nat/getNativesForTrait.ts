import { TraitInfo } from '../abc/lazy/TraitInfo';
import { InstanceInfo } from '../abc/lazy/InstanceInfo';
import { assert } from '@awayjs/graphics';
import { release, assertUnreachable, pushMany } from '@awayfl/swf-loader';
import { ClassInfo } from '../abc/lazy/ClassInfo';
import { builtinNativeClasses, nativeClasses } from './builtinNativeClasses';
export function getNativesForTrait(trait: TraitInfo): Object [] {
	let className = null;
	let natives: Object [];

	if (trait.holder instanceof InstanceInfo) {
		const instanceInfo = <InstanceInfo>trait.holder;
		className = instanceInfo.getClassName();
		var native = builtinNativeClasses[className] || nativeClasses[className];
		assert (native, 'Class native is not defined: ' + className);
		natives = [native.prototype];
		if (native.instanceNatives) {
			pushMany(natives, native.instanceNatives);
		}
	} else if (trait.holder instanceof ClassInfo) {
		const classInfo = <ClassInfo>trait.holder;
		className = classInfo.instanceInfo.getClassName();
		var native = builtinNativeClasses[className] || nativeClasses[className];
		assert (native, 'Class native is not defined: ' + className);
		natives = [native];
		if (native.classNatives) {
			pushMany(natives, native.classNatives);
		}
	} else {
		release || assertUnreachable('Invalid trait type');
	}
	return natives;
}