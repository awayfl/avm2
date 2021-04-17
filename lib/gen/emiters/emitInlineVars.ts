import { CompilerState } from '../CompilerState';

export function emitInlineLocal(_state: CompilerState, n: number): string {
	if (_state.canUseRealThis && n === 0)
		return 'this';

	return n === 0  ? '_this' : 'local' + n;
}

export const UNDERRUN = '[stack underrun]';
export function emitInlineStack(_state: CompilerState, n: number): string {
	const current = _state.currentOppcode;
	const stack = current.stack;

	return ((stack - 1 - n) >= 0)
		? `stack${(stack - 1 - n)}`
		: `/*${UNDERRUN} ${stack - 1 - n}*/ stack0`;

}