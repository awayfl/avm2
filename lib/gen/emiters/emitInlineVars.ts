import { CompilerState } from '../CompilerState';

export function emitInlineLocal(_state: CompilerState, n: number): string {
	if (_state.canUseRealThis && n === 0)
		return 'this';

	return n === 0  ? '_this' : 'local' + n;
}

export const UNDERRUN = '[stack underrun]';
export function emitInlineStack(_state: CompilerState, n: number, aliasThis = true): string {
	const current = _state.currentOpcode;
	const stack = current.stack;
	const underrun = ((stack - 1 - n) < 0);

	if (underrun) {
		return `/*${UNDERRUN} ${stack - 1 - n}*/ null`;
	}

	const alias = 'stack' + (stack - 1 - n);

	if (_state.isThisAlias(alias) && aliasThis)
		return emitInlineLocal(_state, 0); // this ALWAYS is local 0

	return alias;
}