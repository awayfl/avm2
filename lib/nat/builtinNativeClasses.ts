import { MapObject, ObjectUtilities } from '@awayfl/swf-loader';

import { ASClass } from './ASClass';
import { NamespaceType } from '../abc/lazy/NamespaceType';
export const builtinNativeClasses: MapObject<typeof ASClass> = ObjectUtilities.createMap<typeof ASClass>();
export const nativeClasses: MapObject<typeof ASClass> = ObjectUtilities.createMap<typeof ASClass>();
export const nativeClassLoaderNames: {
	name: string;
	alias: string;
	nsType: NamespaceType
} [] = [];