import { NamespaceType } from '../abc/lazy/NamespaceType';
import { AXApplicationDomain } from '../run/AXApplicationDomain';
import { runtimeWriter } from '../run/writers';
import { createContainersFromPath } from './createContainersFromPath';
import { defineClassLoader } from './defineClassLoader';
import { Multiname } from '../abc/lazy/Multiname';

export function makeClassLoader(applicationDomain: AXApplicationDomain, container: Object,
	classPath: string, aliasPath: string, nsType: NamespaceType) {
	runtimeWriter && runtimeWriter.writeLn('Defining Memoizer: ' + classPath);
	const aliasPathTokens = aliasPath.split('.');
	const aliasClassName = aliasPathTokens.pop();
	container = createContainersFromPath(aliasPathTokens, container);
	const mn = Multiname.FromFQNString(classPath, nsType);
	defineClassLoader(applicationDomain, container, mn, aliasClassName);
}
