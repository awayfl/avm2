import { AXSecurityDomain } from '../run/AXSecurityDomain';
import { release } from '@awayfl/swf-loader';
import { assert, isNullOrUndefined } from '@awayjs/graphics';

/**
 * Transforms a JS value into an AS value.
 */
export function transformJSValueToAS(sec: AXSecurityDomain, value, deep: boolean) {
	release || assert(typeof value !== 'function');
	if (typeof value !== 'object') {
		return value;
	}
	if (isNullOrUndefined(value)) {
		return value;
	}
	if (Array.isArray(value)) {
		const list = [];
		for (let i = 0; i < value.length; i++) {
			const entry = value[i];
			const axValue = deep ? transformJSValueToAS(sec, entry, true) : entry;
			list.push(axValue);
		}
		return sec.createArray(list);
	}
	return sec.createObjectFromJS(value, deep);
}
