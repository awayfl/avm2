import { AXClass } from '../run/AXClass';
import { builtinNativeClasses, nativeClasses } from './builtinNativeClasses';
import { linkClass } from './linkClass';
import { ASObject } from './ASObject';
import { ASClass } from './ASClass';

export function tryLinkNativeClass(axClass: AXClass) {
	const className = axClass.classInfo.instanceInfo.getClassName();
	const asClass: ASClass = builtinNativeClasses[className] || nativeClasses[className];
	if (asClass) {
		linkClass(axClass, asClass);
	}
}