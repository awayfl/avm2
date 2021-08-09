import { ABCFile } from '../abc/lazy/ABCFile';
import { ExceptionInfo } from '../abc/lazy/ExceptionInfo';
import { MethodInfo } from '../abc/lazy/MethodInfo';
import { TRAIT } from '../abc/lazy/TRAIT';
import { Settings } from '../Settings';
import { Multiname } from '../abc/lazy/Multiname';
import { Instruction } from './Instruction';
import { emitInlineLocal, emitInlineStack } from './emiters';

export const enum VAR_KIND {
	CONST = 'const',
	VAR = 'var',
	LOOKUP = 'lookup',
	ALIAS = 'alias',
}

interface IVar {
	pos?: number;
}

interface IConstData extends IVar {
	kind: VAR_KIND.CONST;
	value: any;
}

interface ILookupData extends IVar {
	kind: VAR_KIND.LOOKUP;
	scope: number;
	type: Multiname | null;
}

interface IAliasData extends IVar {
	kind: VAR_KIND.ALIAS;
	value: any;
	type?: Multiname
}

interface IVarData extends IVar {
	kind: VAR_KIND.VAR;
	type: Multiname | null;
}

type TVariableArgument = IConstData | IVarData | IAliasData | ILookupData;

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

	public thisAliases: Set<string> = new Set();
	public constAliases: Record<string, IConstData | IAliasData> = {};
	// back ref to local-> stack
	public localAliases: Record<string, string> = {};

	public localTypes: Record<number, Array<Multiname>> = {};

	public stackAliases: Record<number, TVariableArgument> = {};

	public noHoistMultiname: boolean = Settings.NO_HOIST_MULTINAME;

	public get indent() {
		return this._indent;
	}

	public setStackAlias (stackIndex: number, alias: TVariableArgument | null = null): TVariableArgument {
		const realIndex = this.evalStackIndex(stackIndex);
		this.stackAliases [realIndex] = alias;
		return alias;
	}

	public getStackAlias (stackIndex: number): TVariableArgument | null {
		return this.stackAliases [this.evalStackIndex(stackIndex)];
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

		this.init();
	}

	private init() {

		if (this.methodInfo.parentInfo) {
			this.localTypes[0] = [this.methodInfo.parentInfo.getTypeName()];
		}

		let i = 1;
		for (const param of this.methodInfo.parameters) {
			this.localTypes[i] = param.getType() ?  [param.getType()] : [];
			i++;
		}
	}

	public evalStackIndex(stackOffset: number): number {
		const stack = this.currentOpcode.stack;
		const mapped = (stack - 1 - stackOffset);

		if (mapped < 0) return -1;

		return  mapped;
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
	 * Emit constant assigment, and store it in alias tree
	 * @param stackIndex
	 * @param value
	 * @param isConst - value real primitive const value, not a const alias
	 */
	public emitConst(stackIndex: number, value: any, isConst = true) {
		const real = this.evalStackIndex(stackIndex);
		const name = emitInlineStack(this, stackIndex, false);

		this.popAnyAlias(name);

		if (Settings.UNSAFE_INLINE_CONST) {
			this.constAliases[name] = {
				value,
				kind: isConst ?  VAR_KIND.CONST : VAR_KIND.ALIAS,
				pos: this.mainBlock.length
			};

			this.stackAliases[real] = this.constAliases[name];
		}

		if (isConst && typeof value === 'string')
			value = JSON.stringify(value);

		return this.mainBlock.push(this.indent + name + ' = ' + value + ';');
	}

	public emitGetLocal(stackIndex: number, localIndex: number) {
		const stack = emitInlineStack(this, stackIndex, false);

		this.popAnyAlias(stack);
		// local 0 is ALWAYS THIS
		if (localIndex === 0) {
			this.pushThisAlias(stack);
		}

		if (Settings.UNSAFE_INLINE_CONST) {
			const local = 'local' + localIndex;

			this.constAliases[stack] = { value: local, pos: this.mainBlock.length, kind: VAR_KIND.ALIAS };
			this.localAliases[local] = stack;
		}

		if (this.localTypes[localIndex] && this.localTypes[localIndex][0]) {
			this.emitMain('// JIT: potential type:' + this.localTypes[localIndex][0].toString());
		}

		return this.mainBlock.push(this.indent + stack + ' = ' + emitInlineLocal(this, localIndex) + ';');
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

	public killConstAliasInstruction(aliases: string[]) {
		if (!aliases || aliases.length === 0) return;

		for (const a of aliases) {
			if (this.constAliases[a]) {
				const instr = this.mainBlock[this.constAliases[a].pos];
				this.mainBlock[this.constAliases[a].pos] = '//' + instr + '// JIT: redundant assigment, value unused';
			}
		}
	}

	public getConstAliasMeta (stackOffset: number): IConstData | IAliasData {
		if (!Settings.UNSAFE_INLINE_CONST)
			return  null;

		return this.constAliases['stack' + this.evalStackIndex(stackOffset)];
	}

	public getConstAlias (alias: string): string {
		if (!Settings.UNSAFE_INLINE_CONST)
			return  alias;

		const val = this.constAliases[alias];

		if (!val)
			return alias;

		// we should don't map value for this, because maybe a fast mapping
		if (val.kind !== VAR_KIND.CONST) {
			return val.value;
		}

		if (typeof  val.value === 'string') {
			return JSON.stringify(val.value);
		}

		return '' + val.value;
	}

	public isThisAlias(alias: string): boolean {
		if (!Settings.UNSAFE_PROPAGATE_THIS)
			return false;

		return this.thisAliases.has(alias);
	}

	public pushThisAlias(alias: string, from?: string): boolean {
		if (!Settings.UNSAFE_PROPAGATE_THIS)
			return false;

		if (from && !this.thisAliases.has(from))
			return false;

		if (this.thisAliases.has(alias))
			return false;

		this.thisAliases.add(alias);

		return true;
	}

	public dropAllAliases() {
		this.constAliases = {};
		this.localAliases = {};
	}

	public popAnyAlias(stackOrLocal: string): boolean {
		// remove back referenced alias for local
		if (stackOrLocal in this.localAliases) {
			const l = stackOrLocal;
			stackOrLocal = this.localAliases[l];

			delete this.localAliases[l];
		}

		//remove and const alias, reassigment
		delete this.constAliases[stackOrLocal];
		return this.thisAliases.delete(stackOrLocal);
	}
}