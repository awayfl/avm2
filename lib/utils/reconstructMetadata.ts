import { ClassInfo } from '../abc/lazy/ClassInfo';
import { InstanceInfo } from '../abc/lazy/InstanceInfo';
import { MethodTraitInfo } from '../abc/lazy/MethodTraitInfo';
import { Multiname } from '../abc/lazy/Multiname';
import { namespaceTypeNames } from '../abc/lazy/NamespaceType';
import { getTRAITName, TRAIT, TRAITNames } from '../abc/lazy/TRAIT';
import { MethodInfo } from './../abc/lazy/MethodInfo';

let SCRIPT_ID = 0;

const validTest = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export interface IMethodReadableMeta {
	index: number;
	name: string;
	filePath: string;
	classPath: string;
	type: string;
	superClass?: string;
	returnType?: string;
	isValidName: boolean;
	isValidPath: boolean;
	kind?: string;
}

export function validateName(name: string) {
	return validTest.test(name);
}

export const CLASSES_NAMES_COLLISIONS: Record<string, number> = {};
export function nextScriptID(): number {
	return SCRIPT_ID++;
}

export function reconstructMetadata (methodInfo: MethodInfo, id: number): IMethodReadableMeta {
	const prefix = ('' + (id)).padLeft('0', 4);
	const funcName = (methodInfo.getName()).replace(/([^a-z0-9]+)/gi, '_');

	let pathIsDefault = true;
	let fullPath = `__root__/${prefix}_${funcName || 'unknown'}`;
	let path = fullPath;
	let methodName = funcName;
	let isMemeber = true;
	let methodType = 'Public';
	let superClass = undefined;

	if (methodInfo.trait) {
		if (methodInfo.trait.holder instanceof ClassInfo) {
			path =  methodInfo.trait.holder.instanceInfo.getClassName().replace(/\./g, '/');
			isMemeber = false;
		} else if (methodInfo.trait.holder instanceof InstanceInfo) {
			path = methodInfo.trait.holder.getClassName().replace(/\./g, '/');
			superClass =  methodInfo.trait.holder.getSuperName()?.
				toFQNString(false).replace(/\./g, '/');
		}
		if (methodInfo.trait instanceof MethodTraitInfo) {
			methodName = (<Multiname>methodInfo.trait.name).name;
			methodType = namespaceTypeNames[(<Multiname>methodInfo.trait.name).namespace.type];
		}

		if (methodInfo.trait && methodInfo.trait.kind === TRAIT.Getter) {
			methodName = 'get_' + methodName;
		}

		if (methodInfo.trait && methodInfo.trait.kind === TRAIT.Setter) {
			methodName = 'set_' + methodName;
		}

		if (methodInfo.isConstructor) {
			//constructor
			methodName = 'constructor';
		} else {
			// member
			methodName  = isMemeber ?  ('m_' + methodName) : methodName;
		}

		pathIsDefault = false;
		fullPath = path + '/' + methodName;

		if (CLASSES_NAMES_COLLISIONS[fullPath] !== undefined) {
			const index = CLASSES_NAMES_COLLISIONS[fullPath] = CLASSES_NAMES_COLLISIONS[fullPath] + 1;
			fullPath += '$' + index;
		} else {
			CLASSES_NAMES_COLLISIONS[fullPath] = 0;
		}
	}

	// for instances
	if (methodInfo.instanceInfo) {
		path = methodInfo.instanceInfo.getClassName().replace(/\./g, '/');
		methodName = methodInfo.isConstructor ? 'constructor' : funcName;
		superClass = methodInfo.instanceInfo.getSuperName()?.
			toFQNString(false).replace(/\./g, '/');

		pathIsDefault = false;
		fullPath = path + '/' + methodName;
	}

	let hookMethodPath = `${path}${isMemeber ? '::' : '.'}${methodName}`;

	// reconstruct path to owner method
	if (methodInfo.parentInfo && pathIsDefault) {
		fullPath = methodInfo.parentInfo!.meta.filePath + '/' + `${prefix}_${methodName}`;
		hookMethodPath = fullPath;
	}

	return {
		index: methodInfo.index(),
		filePath: fullPath,
		classPath: hookMethodPath,
		name: methodName,
		type: methodType,
		superClass: superClass,
		returnType: methodInfo.getTypeName()?.toString() || '*',
		isValidName: validateName(methodName),
		isValidPath: validateName(path.replace('/','_')),
		kind: methodInfo.trait && TRAITNames[methodInfo.trait.kind]
	};
}