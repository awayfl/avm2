import { AXFunction } from './AXFunction';
import { assert } from '@awayjs/graphics';
import { release } from '@awayfl/swf-loader';

/**
 * Returns the current interpreter frame's callee.
 */
export function axGetArgumentsCallee(): AXFunction {
	const callee = this.callee;
	if (callee) {
		return callee;
	}
	release || assert(this.receiver);
	release || assert(this.methodInfo);
	if (this.methodInfo.trait === null) {
		console.error('arguments.callee used on trait-less methodInfo function. Probably a constructor');
		return null;
	}
	release || assert(this.methodInfo.trait);
	const mn = this.methodInfo.trait.name;
	const methodClosure = this.receiver.axGetProperty(mn);
	release || assert(this.sec.AXMethodClosure.tPrototype === Object.getPrototypeOf(methodClosure));
	return methodClosure;
}