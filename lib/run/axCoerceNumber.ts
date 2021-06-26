import { ASNumber } from '../nat/ASNumber';
import { Settings } from '../Settings';

export function axCoerceNumber(x): number {
	if (Settings.FOLLOW_AS3_BUG) {
		if (typeof x === 'string') {
			return ASNumber.convertStringToDouble(x);
		}
		if (x && typeof x === 'object') {
			x = x.valueOf(); // Make sure to only call valueOf() once.
			if (typeof x === 'string') {
				return ASNumber.convertStringToDouble(x);
			}
		}
	}
	return +x;
}