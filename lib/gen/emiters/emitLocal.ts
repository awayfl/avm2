import { CompilerState } from './../CompilerState';

export function emitLocal(_state: CompilerState, n: number): string {
	return n === 0  ? '_this' : 'local' + n;
}