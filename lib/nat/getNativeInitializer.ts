import { ClassInfo } from '../abc/lazy/ClassInfo';
import { AXCallable } from '../run/AXCallable';
import { builtinNativeClasses , nativeClasses } from './builtinNativeClasses';

export function getNativeInitializer(classInfo: ClassInfo): AXCallable {
	const methodInfo = classInfo.instanceInfo.getInitializer();
	const className = classInfo.instanceInfo.getClassName();
	const asClass = builtinNativeClasses[className] || nativeClasses[className];
	if (methodInfo.isNative() || asClass?.forceNative) {
		// Use TS constructor as the initializer function.
		return <any>asClass;
	}
	//// TODO: Assert eagerly.
	//return function () {
	//  release || assert (!methodInfo.isNative(), "Must supply a constructor for " + classInfo +
	// "."); }
	return null;
}