import { MapObject, createMap } from '@awayfl/swf-loader';

import { ASClass } from './ASClass';
import { NamespaceType } from '../abc/lazy/NamespaceType';

export const builtinNativeClasses: MapObject<ASClass> = createMap<ASClass>();
export const nativeClasses: MapObject<ASClass> = createMap<ASClass>();
export const nativeClassLoaderNames: {
	name: string;
	alias: string;
	nsType: NamespaceType
} [] = [];