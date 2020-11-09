import { MapObject, ObjectUtilities } from '@awayfl/swf-loader';

import { ASClass } from './ASClass';
import { NamespaceType } from '../abc/lazy/NamespaceType';

export const builtinNativeClasses: MapObject<ASClass> = ObjectUtilities.createMap<ASClass>();
export const nativeClasses: MapObject<ASClass> = ObjectUtilities.createMap<ASClass>();
export const nativeClassLoaderNames: {
	name: string;
	alias: string;
	nsType: NamespaceType
} [] = [];