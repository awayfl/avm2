import { isNumeric } from '@awayfl/swf-loader';
import { assert, isNullOrUndefined } from '@awayjs/graphics';
import { release } from '@awayfl/swf-loader';
import { AXSecurityDomain } from '../run/AXSecurityDomain';

/**
 * Transforms an AS value into a JS value.
 */
export function transformASValueToJS(
	sec: AXSecurityDomain, value: any,
	deep: boolean, replacerFunction: (key: string, value: any) => any = null, key: string = null): {} {

	if (replacerFunction)
		value = replacerFunction(key, value);

	if (typeof value !== 'object' || isNullOrUndefined(value)) {
		return value;
	}
	if (isNullOrUndefined(value)) {
		return value;
	}
	if (sec.AXArray.axIsType(value)) {
		const resultList = [];
		// this can be a JS array
		const list = Array.isArray(value) ? value : value.value;

		for (let i = 0; i < list.length; i++) {
			const entry = list[i];
			const jsValue = deep ? transformASValueToJS(sec, entry, true, replacerFunction, i.toString()) : entry;
			resultList.push(jsValue);
		}
		return resultList;
	}
	if (sec.ObjectVector.axClass.axIsType(value)) {
		const resultList = [];
		const list = value._buffer;
		for (let i = 0; i < list.length; i++) {
			const entry = list[i];
			const jsValue = deep ? transformASValueToJS(sec, entry, true, replacerFunction, i.toString()) : entry;
			resultList.push(jsValue);
		}
		return resultList;
	}

	const keys = Object.keys(value);
	const resultObject = {};

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (key == '__scope__') {
			continue;
		}
		let jsKey = key;
		if (!isNumeric(key)) {
			release || assert(key.indexOf('$Bg') === 0);
			jsKey = key.substr(3);
		}
		let v = value[key];
		if (deep) {
			v = transformASValueToJS(sec, v, true, replacerFunction, jsKey);
		}
		resultObject[jsKey] = v;
	}
	return resultObject;
}