import { AXObject } from './AXObject';
import { Scope } from './Scope';
import { ClassInfo } from '../abc/lazy/ClassInfo';
import { Multiname } from '../abc/lazy/Multiname';
import { ASClass } from '../nat/ASClass';
import { AXApplicationDomain } from './AXApplicationDomain';

export const IS_AX_CLASS = Symbol('AX class marker');

export interface AXClass extends AXObject {
	[IS_AX_CLASS]: boolean;
	scope: Scope;
	asClass: ASClass;
	superClass: AXClass;
	classInfo: ClassInfo;
	name: Multiname;
	axApplicationDomain: AXApplicationDomain;
	// Used to initialize Vectors.
	defaultValue: any;
	tPrototype: AXObject;
	dPrototype: AXObject;
	axBox: (x: any) => any;
	axConstruct: (args: any[]) => AXObject;
	axApply: (self: AXObject, args: any[]) => any;
	axCoerce: (x: any) => any;
	axIsType: (x: any) => boolean;
	axAsType: (x: any) => boolean;
	axIsInstanceOf: (x: any) => boolean;
	axImplementsInterface: (x: AXClass) => boolean;
}