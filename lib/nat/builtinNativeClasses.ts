import { ASClass } from './ASClass';
import { NamespaceType } from '../abc/lazy/NamespaceType';

export const builtinNativeClasses: Record<string, ASClass> = {};
export const nativeClasses: Record<string, ASClass> = {};
export const nativeClassLoaderNames: {
	name: string;
	alias: string;
	nsType: NamespaceType
} [] = [];