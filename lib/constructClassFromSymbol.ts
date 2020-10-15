import { assert } from '@awayjs/graphics';
import { release } from '@awayfl/swf-loader';
import { AXClass, IS_AX_CLASS } from './run/AXClass';

export function constructClassFromSymbol(symbol: any, axClass: AXClass) {
	const instance = Object.create(axClass.tPrototype);
	if (instance._symbol) {
		release || assert(instance._symbol === symbol);
	} else {
		instance._symbol = symbol;
	}

	if (instance.applySmybol)
		instance.applySymbol();

	instance[IS_AX_CLASS] = true;
	return instance;
}