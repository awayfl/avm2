import { CompilerState } from '../CompilerState';

export function emitInlineLocal(_state: CompilerState, n: number): string {
	if (_state.canUseRealThis && n === 0)
		return 'this';

	return n === 0  ? '_this' : 'local' + n;
}

export const UNDERRUN = '[stack underrun]';
export function emitInlineStack(_state: CompilerState, n: number, useAlias = true): string {
	const mapped = _state.evalStackIndex(n);

	if (mapped < 0) {
		return `/*${UNDERRUN} ${mapped}*/ null`;
	}

	const alias = 'stack' + (mapped);

	if (!useAlias) {
		return alias;
	}

	if (_state.isThisAlias(alias))
		return emitInlineLocal(_state, 0); // this ALWAYS is local 0

	return _state.getConstAlias(alias);
}