import { AXClass } from '../run/AXClass';
import { builtinNativeClasses, nativeClasses } from './builtinNativeClasses';
import { linkClass } from './linkClass';

export function tryLinkNativeClass(axClass: AXClass) {
	const className = axClass.classInfo.instanceInfo.getClassName();
	const asClass = builtinNativeClasses[className] || nativeClasses[className];
	if (asClass) {
		linkClass(axClass, asClass);
	}
}