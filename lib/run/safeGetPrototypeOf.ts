import { AXObject } from './AXObject';
import { release } from '@awayfl/swf-loader';
import { assert } from '@awayjs/graphics';

/**
 * Make sure we bottom out at the securityDomain's objectPrototype.
 */
export function safeGetPrototypeOf(object: AXObject): AXObject {
	const axClass = object.axClass;
	if (!axClass || axClass === axClass.sec.AXObject) {
		return null;
	}

	let prototype = axClass.dPrototype;
	if (prototype === object) {
		prototype = axClass.superClass.dPrototype;
	}
	release || assert(prototype.sec);
	return prototype;
}