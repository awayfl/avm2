import { CompilerState } from '../CompilerState';

export function emitInlineMultiname(state: CompilerState, index: number): string {
	if (state.names.length <= index)
		throw 'Name index out of bounds';

	return 'name' + index;
}