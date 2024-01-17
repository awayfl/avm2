import { StringUtilities } from '@awayfl/swf-loader';

export function AXBasePrototype_$BgtoString() {
	// Dynamic prototypes just return [object Object], so we have to special-case them.
	// Since the dynamic object is the one holding the direct reference to `classInfo`,
	// we can check for that.
	const name = this.hasOwnProperty('classInfo') ?
		'Object' :
		this.classInfo.instanceInfo.multiname.name;
	return StringUtilities.concat3('[object ', name, ']');
}