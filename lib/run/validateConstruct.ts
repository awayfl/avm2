import { AXSecurityDomain } from './AXSecurityDomain';
import { AXClass } from './AXClass';
import { Errors } from '../errors';

export function validateConstruct(sec: AXSecurityDomain, axClass: AXClass, argc: number) {
	if (!axClass || !axClass.axConstruct) {
		const name = axClass && axClass.classInfo ?
			axClass.classInfo.instanceInfo.multiname.name :
			'value';
		sec.throwError('TypeError', Errors.ConstructOfNonFunctionError, name);
	}
	const methodInfo = axClass.classInfo.methodInfo;
	if (argc < methodInfo.minArgs) {
		sec.throwError('ArgumentError', Errors.WrongArgumentCountError,
			axClass.classInfo.instanceInfo.multiname.name,
			methodInfo.minArgs, argc);
	}
}