import { Bytecode } from './../Bytecode';
import { ExceptionInfo } from './../abc/lazy/ExceptionInfo';

const DEFAULT_STACK_INDEX = -1024;

export class Instruction {
	public stack: number = DEFAULT_STACK_INDEX;
	public scope: number = DEFAULT_STACK_INDEX;
	public catchBlock: ExceptionInfo;
	public catchStart: boolean = false;
	public catchEnd: boolean = false;
	public returnTypeId: number = -1; // void
	public childs: number[] = [];
	public comment: string = null;

	constructor(
		readonly position: number,
		public name: Bytecode,
		readonly params: Array<any> = [],
		readonly delta: number = 0,
		readonly deltaScope: number = 0,
		readonly terminal: boolean = false,
		readonly refs: Array<number> = []) {
	}

	toString() {
		// eslint-disable-next-line max-len
		return `Instruction(${this.position}, ${Bytecode[this.name]} (${this.name}), [${this.params}], ${this.stack} -> ${this.stack + this.delta}, ${this.scope} -> ${this.scope + this.deltaScope}, ${this.terminal}, [${this.refs}])`;
	}
}