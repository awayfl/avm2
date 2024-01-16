import { MethodInfo } from './../abc/lazy/MethodInfo';

/**
 * Generate tiny constructor for nested class when it only call super
 */
export class TinyConstructor {
	test(method: MethodInfo) {
		// skip noConstructors
		if (!method.isConstructor) return false;
		// skip constuctors with arguments
		if (method.parameters.length > 0) return false;

		const body = method.getBody();

		// stack more that 1? oh
		if (body.maxStack > 1) return false;

		// use more that 1 local? oh
		if (body.localCount > 1) return false;

		// increase scope? oh
		if (body.maxScopeDepth - body.initScopeDepth > 1) return false;

		// method use 6 opcodes
		if (body.code.length > 6) return false;

		return true;
	}

	getBody(method: MethodInfo): Function | null {
		if (!this.test(method)) {
			return null;
		}
		return function (context: any) {
			return function tiny_constructor() {
				context.savedScope.superConstructor.call(this);
			};
		};
	}
}