import { CompilerState } from '../CompilerState';

export function emitInlineMultiname(state: CompilerState, index: number): string {
	if (state.names.length <= index)
		throw 'Name index out of bounds';

	if (state.noHoistMultiname) {
		return '$names[' + index + ']';
	}

	return 'name' + index;
}