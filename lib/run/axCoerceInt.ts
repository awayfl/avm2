import { axCoerceNumber } from './axCoerceNumber';
import { Settings } from '../Settings';

export function axCoerceInt(x): number {
	if (Settings.FOLLOW_AS3_BUG) {
		x = axCoerceNumber(x);
	}

	return x | 0;
}