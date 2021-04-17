import { ABCFile } from '../abc/lazy/ABCFile';
import { ExceptionInfo } from '../abc/lazy/ExceptionInfo';
import { MethodInfo } from '../abc/lazy/MethodInfo';
import { TRAIT } from '../abc/lazy/TRAIT';
import { Settings } from '../Settings';
import { Multiname } from './../abc/lazy/Multiname';
import { Instruction } from './affiliate';

export class CompilerState {
	private _indent: string = '';
	private _indentLen: number = 0;

	public methodInfo: MethodInfo
	public abc: ABCFile;
	public names: Multiname[] = [];
	public openTryCatchGroups: ExceptionInfo[][] = [];
	// same as js0 in compile
	public mainBlock: string[] = [];
	// same as js in compile
	public headerBlock: string[] = [];

	public oppcodes: Instruction[];
	public currentOppcode: Instruction;

	public get indent() {
		return this._indent;
	}

	public get isPossibleGlobalThis() {
		const kind = this.methodInfo.trait && this.methodInfo.trait.kind;

		// because in AS3 methods/get/set is stricted with this, it can't be global
		return kind !== TRAIT.Method && kind !== TRAIT.Getter && kind !== TRAIT.Setter;
	}

	public get canUseRealThis() {
		if (!Settings.EMIT_REAL_THIS) return false;

		return !this.isPossibleGlobalThis;
	}

	constructor (methodInfo: MethodInfo) {
		this.methodInfo = methodInfo;
		this.abc = methodInfo.abc;
	}

	public moveIndent (offset: number) {
		this._indentLen += offset * 4;
		if (this._indentLen < 0)
			this._indentLen = 0;

		this._indent = (' ').repeat(this._indentLen ? this._indentLen - 1 : 0);

		return this._indent;
	}

	public getMultinameIndex(nameOrIndex: Multiname | number) {
		const name = typeof nameOrIndex === 'number'
			? this.abc.getMultiname(nameOrIndex)
			: nameOrIndex;

		const index = this.names.indexOf(name);

		if (index > -1)
			return index;

		this.names.push(name);

		return this.names.length - 1;
	}

	/**
	 * Push line to main code block and prepend indent automatically
	 * @param line Line to emit to generated code
	 * @returns line count
	 */
	public emitMain(line: string): number {
		return this.mainBlock.push(this.indent + ' ' + line);
	}

	/**
	 * Push line to head code block WITHOUT ident, because it not track it
	 * @param line Line to emit to generated code
	 * @returns line count
	 */
	public emitHead(line: string, indent: string = ''): number {
		return this.headerBlock.push(indent + ' ' + line);
	}

	/**
	 * Emit block begin ({) and move indent right
	 * @param beforeBracket string that was emited before {
	 */
	public emitBeginMain(beforeBracket = '') {
		const pos = this.emitMain(beforeBracket + ' {');
		this.moveIndent(1);
		return pos;
	}

	/**
	 * Emit block end } and move indent left
	 */
	public emitEndMain() {
		this.moveIndent(-1);
		const pos = this.emitMain('}');
		return pos;
	}

}