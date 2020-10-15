import { ASObject } from '../nat/ASObject';

export function forEachPublicProperty(object: ASObject, callbackfn: (property: any, value: any) => void, thisArg?: any) {
	// REDUX: Do we need to walk the proto chain here?
	const properties = object.axGetEnumerableKeys();
	for (let i = 0; i < properties.length; i++) {
		const property = properties[i];
		const value = object.axGetPublicProperty(property);
		callbackfn.call(thisArg, property, value);
	}
}
