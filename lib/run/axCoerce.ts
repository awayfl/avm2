import { Errors } from '../errors';
import { IS_AX_CLASS } from './AXClass';

export function axCoerce(x: any) {
	// fast path, null == void 0 is true
	if (x == void 0) {
		return null;
	}

	if (!x[IS_AX_CLASS] || x.__fast__) {
		return x;
	}

	// propagate fast mode for arrays with fast entries
	if (Array.isArray(x) && (x[0] && x[0].__fast__)) {
		return x;
	}

	if (!this.axIsType(x)) {
		this.sec.throwError('TypeError', Errors.CheckTypeFailedError, x,
			this.classInfo.instanceInfo.getClassName());
	}

	return x;
}