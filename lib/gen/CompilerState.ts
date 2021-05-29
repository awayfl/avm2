import { ABCFile } from '../abc/lazy/ABCFile';
import { ExceptionInfo } from '../abc/lazy/ExceptionInfo';
import { MethodInfo } from '../abc/lazy/MethodInfo';
import { TRAIT } from '../abc/lazy/TRAIT';
import { Settings } from '../Settings';
import { Multiname } from './../abc/lazy/Multiname';
import { Instruction } from './Instruction';

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

	public opcodes: Instruction[];
	public currentOpcode: Instruction;

	public thisAlliases: Set<string> = new Set();
	public noHoistMultiname: boolean = Settings.NO_HOIST_MULTINAME;

	public get indent() {
		return this._indent;
	}

	public get isPossibleGlobalThis() {
		const kind = this.methodInfo.trait && this.methodInfo.trait.kind;

		// because in AS3 methods/get/set is stricted with this, it can't be global
		return (
			kind !== TRAIT.Method &&
			kind !== TRAIT.Getter &&
			kind !== TRAIT.Setter &&
			!this.methodInfo.isConstructor
		);
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

		this._indent = (' ').repeat(this._indentLen);

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
	public emitMain(line: string = ''): number {
		return this.mainBlock.push(this.indent + line);
	}

	/**
	 * Push line to head code block WITHOUT ident, because it not track it
	 * @param line Line to emit to generated code
	 * @returns line count
	 */
	public emitHead(line: string, indent: string = ''): number {
		return this.headerBlock.push(indent + line);
	}

	/**
	 * Emit block begin ({) and move indent right
	 * @param value string that was emited instead of {
	 */
	public emitBeginMain(value: string = '{') {
		const pos = this.emitMain(value);
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

	public isThisAlias(alias: string): boolean {
		if (!Settings.UNSAFE_PROPOGATE_THIS)
			return false;

		return this.thisAlliases.has(alias);
	}

	public pushThisAlias(alias: string, from?: string): boolean {
		if (!Settings.UNSAFE_PROPOGATE_THIS)
			return false;

		if (from && !this.thisAlliases.has(from))
			return false;

		if (this.thisAlliases.has(alias))
			return false;

		this.thisAlliases.add(alias);

		return true;
	}

	public popThisAlias(alias: string): boolean {
		return this.thisAlliases.delete(alias);
	}
}