import { Bytecode } from '../Bytecode';
import { ExceptionInfo } from '../abc/lazy/ExceptionInfo';
import { MethodInfo } from '../abc/lazy/MethodInfo';
import { Instruction } from './Instruction';
import { COMPILATION_FAIL_REASON } from '../flags';
import { Settings } from '../Settings';
import { ABCFile } from '../abc/lazy/ABCFile';

const enum PRIMITIVE_TYPE {
	VOID = -1,
	BOOL = -2,
	NUMBER = -3,
	STRING = -4,
	UNDEF = -5,
	NULL = -6,
	ANY = -1000
}

export interface IAnalyzeError {
	error: {
		message: string, reason: COMPILATION_FAIL_REASON
	};
}

export interface IAnalyseResult {
	jumps: Array<number>;
	set: Array<Instruction>;
	catchStart: NumberMap<ExceptionInfo[]>,
	catchEnd: NumberMap<ExceptionInfo[]>
}
/**
 * Propogade stack for calculation real stack size for every instruction
 */
export function propagateStack(position: number, stack: number, q: Array<Instruction>): number {
	let v = stack;
	const l = q.length;
	let minStack = stack;

	for (let i = 0; i < l; i++) {
		if (q[i].position >= position) {
			if (q[i].stack >= 0)
				return minStack;

			q[i].stack = v;
			v += q[i].delta;

			if (v < minStack) minStack = v;

			for (let j = 0; j < q[i].refs.length; j++) {
				const s = propagateStack(q[i].refs[j], v, q);
				if (s < minStack) minStack = s;
			}

			if (q[i].terminal)
				return minStack;
		}
	}

	return minStack;
}

/**
 * Like as propogadeStack, only for scope
 */
export function propagateScope (position: number, scope: number, q: Array<Instruction>) {
	let v = scope;
	const l = q.length;
	for (let i = 0; i < l; i++) {
		if (q[i].position >= position) {
			if (q[i].scope >= 0)
				return;

			q[i].scope = v;
			v += q[i].deltaScope;

			for (let j = 0; j < q[i].refs.length; j++) {
				propagateScope(q[i].refs[j], v, q);
			}

			if (q[i].terminal)
				return;
		}
	}
}

export function propogateTree(q: Array<Instruction>, jumps: number[]): void {
	const branches = {};
	const condNodes: Instruction[] = [];

	branches[0] = 0;

	const l = q.length;
	for (let i = 1; i < l; i++) {
		const inst = q[i];

		if (jumps.indexOf(inst.position) > -1) {
			branches[inst.position] = i;
		}

		if (inst.name >= Bytecode.IFNLT
			&& inst.name <= Bytecode.LOOKUPSWITCH) {
			condNodes.push(inst);
		}
	}

	for (const c of condNodes) {
		if (c.name === Bytecode.LOOKUPSWITCH) {
			const params = <number[]> c.params;
			c.childs = [];
			for (let i = 0; i < params.length - 1; i++) {
				c.childs.push(branches[i]);
			}
			continue;
		}

		if (c.name === Bytecode.JUMP) {
			c.childs = [branches[c.params[0]]];
			continue;
		}

		c.childs.push(branches[c.params[0]]);
	}

}

type IMnRecord = Array<number>;

interface IPreprocessorState {
	index: number;
	readonly abc: ABCFile;
	readonly code: Uint8Array;
	readonly currentMn: IMnRecord;
}

function u30 (state: IPreprocessorState): number {
	const code = state.code;
	let i = state.index;

	let u = code[i++];
	if (u & 0x80) {
		u = u & 0x7f | code[i++] << 7;
		if (u & 0x4000) {
			u = u & 0x3fff | code[i++] << 14;
			if (u & 0x200000) {
				u = u & 0x1fffff | code[i++] << 21;
				if (u & 0x10000000) {
					u = u & 0x0fffffff | code[i++] << 28;
					u = u & 0xffffffff;
				}
			}
		}
	}

	state.index = i;
	return u >>> 0;
}

function  mn (state: IPreprocessorState) {
	const index = u30(state);
	const name = state.abc.getMultiname(index);
	const mnResult = state.currentMn;

	mnResult[0] = index;

	if (name.isRuntimeName() || name.isRuntimeNamespace()) {
		mnResult[1] = 256;
		mnResult[2] = name.isRuntimeName() && name.isRuntimeNamespace() ? -2 : -1;
		return mnResult;
	}

	mnResult[1] = 0;
	mnResult[2] = 0;

	return mnResult;
}

function s24 (state: IPreprocessorState): number {
	const code = state.code;
	let i = state.index;

	let u = code[i++] | (code[i++] << 8) | (code[i++] << 16);
	u = (u << 8) >> 8;

	state.index = i;
	return u;
}

function s8(state: IPreprocessorState): number {
	return (state.code[state.index++] << 24) >> 24;
}

/**
 * Analyzing instruction set from method info
 * @param methodInfo
 */
export function analyze(methodInfo: MethodInfo): IAnalyseResult | IAnalyzeError {
	const abc = methodInfo.abc;
	const body = methodInfo.getBody();
	const code = body.code;
	const q: Instruction[] = [];

	const state = {
		index: 0,
		abc: abc,
		code: code,
		currentMn: [0,0,0]
	};

	let type: number = 0;
	let lastType: number = 0;
	let requireScope = false;

	for (; state.index < code.length;) {
		const oldi = state.index;
		const z = code[state.index++];

		const last = Settings.OPTIMISE_ON_IR ?  q[q.length - 1] : null;
		let ins: Instruction;

		switch (z) {
			case Bytecode.NOP:
				ins = (new Instruction(oldi, z))
				break;
			case Bytecode.LABEL:
				ins = (new Instruction(oldi, z));
				break;
			case Bytecode.DXNSLATE:
				ins = (new Instruction(oldi, z, 0, -1));
				break;
			case Bytecode.DEBUGFILE:
			case Bytecode.DEBUGLINE:

				ins = (new Instruction(oldi, z, u30(state)));
				break;

			case Bytecode.DEBUG:
				ins = (new Instruction(oldi, z, [s8(state), u30(state), s8(state), u30(state)]));
				break;

			case Bytecode.THROW:
				ins = (new Instruction(oldi, z, null, -1, 0, true));
				break;

			case Bytecode.PUSHSCOPE:
				ins = (new Instruction(oldi, z, null, -1, 1));
				ins.returnTypeId = lastType =  ++type;
				break;

			case Bytecode.PUSHWITH:
				ins = (new Instruction(oldi, z, null, -1, 1));
				break;

			case Bytecode.POPSCOPE:
				ins = (new Instruction(oldi, z, null, 0, -1));
				break;

			case Bytecode.GETSCOPEOBJECT:
				ins = (new Instruction(oldi, z, s8(state), 1, 0));
				ins.returnTypeId = lastType =  ++type;
				requireScope = true;
				break;

			case Bytecode.GETGLOBALSCOPE:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  ++type;
				requireScope = true;

				break;

			case Bytecode.GETSLOT:
				ins = (new Instruction(oldi, z, u30(state), 0));
				ins.returnTypeId = lastType =  ++type;

				break;

			case Bytecode.SETSLOT:
				ins = (new Instruction(oldi, z, u30(state), -2));
				break;

			case Bytecode.NEXTNAME:
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType =  ++type;

				break;

			case Bytecode.NEXTVALUE:
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType =  ++type;

				break;

			case Bytecode.HASNEXT:
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.HASNEXT2:
				ins = (new Instruction(oldi, z, [u30(state), u30(state)], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.IN:
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.DUP:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  type;

				if (last) {
					switch (last.name) {
						case Bytecode.PUSHTRUE:
						case Bytecode.PUSHFALSE:
						case Bytecode.PUSHNAN:
						case Bytecode.PUSHINT:
						case Bytecode.PUSHDOUBLE:
						case Bytecode.PUSHBYTE:
						case Bytecode.PUSHFLOAT:
						case Bytecode.PUSHSTRING:
						case Bytecode.PUSHNULL: {
							ins.name = last.name;
							ins.params = last.params;
							ins.comment = 'IR: DUP changed to PUSH*, reason: prevent optimisation';
						}
					}
				}
				break;

			case Bytecode.POP: {
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType = type;

				//
				if (last && last.name === Bytecode.CALLPROPERTY) {
					last.name = Bytecode.CALLPROPVOID;
					last.comment = 'IR: Optimised from "CALLPROPERTY", reason: POP STACK';
				}
				break;
			}
			case Bytecode.SWAP:
				ins = (new Instruction(oldi, z, null, 0));
				break;

			case Bytecode.PUSHTRUE:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;
				break;

			case Bytecode.PUSHFALSE:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.PUSHBYTE:
				ins = (new Instruction(oldi, z, s8(state), 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHSHORT:
				ins = (new Instruction(oldi, z, u30(state) << 16 >> 16, 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHINT:
				ins = (new Instruction(oldi, z, u30(state), 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHUINT:
				ins = (new Instruction(oldi, z, u30(state), 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHDOUBLE:
				ins = (new Instruction(oldi, z, u30(state), 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHNAN:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHNULL:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NULL;

				break;

			case Bytecode.PUSHUNDEFINED:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.UNDEF;

				break;

			case Bytecode.PUSHSTRING:
				ins = (new Instruction(oldi, z, u30(state), 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.STRING;

				break;

			case Bytecode.IFEQ: {
				const j = s24(state);
				const i = state.index;
				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFNE: {
				const j = s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFSTRICTEQ: {
				const j = s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFSTRICTNE: {
				const j = s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFGT:
			case Bytecode.IFNLE: {
				const j = s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFGE:
			case Bytecode.IFNLT: {
				const j = s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFLT:
			case Bytecode.IFNGE: {
				const j = s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFLE:
			case Bytecode.IFNGT: {
				const j =  s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFTRUE: {
				const j =  s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -1, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFFALSE: {
				const j =  s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, -1, 0, false, [i + j]));
				break;
			}
			case Bytecode.LOOKUPSWITCH: {
				const offset = oldi +  s24(state);
				const cases =  u30(state);

				const table = [offset];

				for (let j = 0; j <= cases; j++)
					table.push(oldi +  s24(state));

				ins = (new Instruction(oldi, z, table, -1, 0, true, table));
				break;
			}
			case Bytecode.JUMP: {
				const j =  s24(state);
				const i = state.index;

				ins = (new Instruction(oldi, z, i + j, 0, 0, true, [i + j]));
				break;
			}
			case Bytecode.RETURNVALUE:
				ins = (new Instruction(oldi, z, null, -1, 0, true));
				break;

			case Bytecode.RETURNVOID:
				ins = (new Instruction(oldi, z, null, 0, 0, true));
				break;

			case Bytecode.NOT:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;
				break;

			case Bytecode.BITNOT:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.NEGATE:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.INCREMENT:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.DECREMENT:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.INCLOCAL:
			case Bytecode.DECLOCAL:
				ins = (new Instruction(oldi, z, u30(state), 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;
				break;

			case Bytecode.INCREMENT_I:
			case Bytecode.DECREMENT_I:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.INCLOCAL_I:
			case Bytecode.DECLOCAL_I:
				ins = (new Instruction(oldi, z, u30(state), 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.NEGATE_I:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.ADD_I:
			case Bytecode.SUBTRACT_I:
			case Bytecode.MULTIPLY_I:
			case Bytecode.ADD:
			case Bytecode.SUBTRACT:
			case Bytecode.MULTIPLY:
			case Bytecode.DIVIDE:
			case Bytecode.MODULO:
			case Bytecode.LSHIFT:
			case Bytecode.RSHIFT:
			case Bytecode.URSHIFT:
			case Bytecode.BITAND:
			case Bytecode.BITOR:
			case Bytecode.BITXOR:
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;
			case Bytecode.EQUALS:
			case Bytecode.STRICTEQUALS:
			case Bytecode.GREATERTHAN:
			case Bytecode.GREATEREQUALS:
			case Bytecode.LESSTHAN:
			case Bytecode.LESSEQUALS:
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;
				break;

			case Bytecode.TYPEOF:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.INSTANCEOF: {
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType = PRIMITIVE_TYPE.BOOL;

				break;
			}
			case Bytecode.ISTYPE: {
				const [index, , d] = mn(state);
				ins = (new Instruction(oldi, z, index, 0 + d));
				ins.returnTypeId = lastType = PRIMITIVE_TYPE.BOOL;
				requireScope = true;
				break;
			}
			case Bytecode.ISTYPELATE:
				ins = (new Instruction(oldi, z, null, -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;
				requireScope = true;
				break;
			case Bytecode.ASTYPELATE:
				ins = (new Instruction(oldi, z, null, -1));

				break;
			case Bytecode.ASTYPE: {
				const [index, , d] = mn(state);
				ins = (new Instruction(oldi, z, index, 0 + d));
				requireScope = true;

				break;
			}
			case Bytecode.CALL: {
				const argnum = u30(state);
				ins = (new Instruction(oldi, z, argnum, -argnum - 1));
				requireScope = true;
				break;
			}
			case Bytecode.CONSTRUCT: {
				const argnum = u30(state);
				ins = (new Instruction(oldi, z, argnum, -argnum));
				ins.returnTypeId = lastType = ++type;
				break;
			}
			case Bytecode.CALLPROPERTY: {
				const [index, dyn, d] = mn(state);
				const argnum = u30(state);
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				ins.returnTypeId = lastType = ++type;
				requireScope = requireScope || dyn !== 0;
				break;
			}
			case Bytecode.CALLPROPLEX: {
				const [index, dyn, d] = mn(state);
				const argnum = u30(state);
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				ins.returnTypeId = lastType = ++type;
				requireScope = requireScope || dyn !== 0;

				break;
			}
			case Bytecode.CALLPROPVOID: {
				const [index, dyn, d] = mn(state);
				const argnum = u30(state);
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -(argnum + 1) + d));
				break;
			}
			case Bytecode.APPLYTYPE: {
				const argnum = u30(state);
				ins = (new Instruction(oldi, z, argnum, -argnum));
				ins.returnTypeId = lastType = type;

				break;
			}
			case Bytecode.FINDPROPSTRICT: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, z + dyn, index, 1 + d));
				ins.returnTypeId = lastType = ++type;
				requireScope = true;

				break;
			}
			case Bytecode.FINDPROPERTY: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, z + dyn, index, 1 + d));
				ins.returnTypeId = lastType = ++type;
				requireScope = true;

				break;
			}
			case Bytecode.NEWFUNCTION:
				ins = (new Instruction(oldi, z, u30(state), 1));
				ins.returnTypeId = lastType =  ++type;
				requireScope = true;
				break;
			case Bytecode.NEWCLASS:
				ins = (new Instruction(oldi, z, u30(state), 0));
				ins.returnTypeId = lastType =  ++type;
				requireScope = true;
				break;
			case Bytecode.GETDESCENDANTS:
				ins = (new Instruction(oldi, z, u30(state), 0));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.NEWARRAY: {
				const argnum = u30(state);
				ins = (new Instruction(oldi, z, argnum, -argnum + 1));
				ins.returnTypeId = lastType = ++type;

				break;
			}
			case Bytecode.NEWOBJECT: {
				const argnum = u30(state);
				ins = (new Instruction(oldi, z, argnum, -2 * argnum + 1));
				ins.returnTypeId = lastType = ++type;

				break;
			}
			case Bytecode.NEWACTIVATION:
				ins = (new Instruction(oldi, z, null, 1));
				ins.returnTypeId = lastType =  ++type;
				requireScope = true;

				break;
			case Bytecode.NEWCATCH:
				ins = (new Instruction(oldi, z, u30(state), 1));
				requireScope = true;

				break;
			case Bytecode.CONSTRUCTSUPER: {
				const argnum = u30(state);
				ins = (new Instruction(oldi, z, argnum, -(argnum + 1)));

				break;
			}
			case Bytecode.CALLSUPER: {
				const [index, dyn, d] = mn(state);
				const argnum = u30(state);
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				break;
			}
			case Bytecode.CALLSUPERVOID: {
				const [index, dyn, d] = mn(state);
				const argnum = u30(state);
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -(argnum + 1) + d));
				break;
			}
			case Bytecode.CONSTRUCTPROP: {
				const  [index, dyn, d] = mn(state);
				const argnum = u30(state);
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				ins.returnTypeId = lastType = ++type;

				break;
			}
			case Bytecode.GETPROPERTY: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, Bytecode.GETPROPERTY + dyn, index, 0 + d));
				ins.returnTypeId = lastType = ++type;

				break;
			}
			// we collapse 2 operation to one, but this is can prevent optimisations
			case Bytecode.INITPROPERTY:
			case Bytecode.SETPROPERTY: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, Bytecode.SETPROPERTY + dyn, index, -2 + d));

				break;
			}
			case Bytecode.DELETEPROPERTY: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, z + dyn, index, 0 + d));
				break;
			}
			case Bytecode.GETSUPER: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, z + dyn, index, 0 + d));
				ins.returnTypeId = lastType = ++type;

				break;
			}
			case Bytecode.SETSUPER: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, z + dyn, index, -2 + d));
				break;
			}
			case Bytecode.COERCE: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, z + dyn, index, 0 + d));
				ins.returnTypeId = lastType;

				// construct prop was called with same MN that used for coerce, redundant
				if (last && last.name === Bytecode.CONSTRUCTPROP && last.params[1] === index) {
					ins.returnTypeId = PRIMITIVE_TYPE.VOID;
					ins.name = Bytecode.LABEL;
					ins.comment = 'IR: Drop coerce, reason: redundant';
					break;
				}

				requireScope = true;
				break;
			}
			case Bytecode.COERCE_A:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.COERCE_S:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = PRIMITIVE_TYPE.STRING;

				break;

			case Bytecode.CONVERT_D: {
				ins = (new Instruction(oldi, z, null, 0));

				if (last) {
					switch (last.name) {
						case Bytecode.PUSHINT:
						case Bytecode.PUSHFLOAT:
						case Bytecode.PUSHDOUBLE:
						case Bytecode.ADD_I:
						case Bytecode.INCREMENT:
						case Bytecode.DECREMENT:
						case Bytecode.DECREMENT_I:
						case Bytecode.INCREMENT_I: {
							ins.name = Bytecode.LABEL;
							ins.comment = 'IR: CONVERT_D removed, reason: arguments strictly number';
							break;
						}
					}
				}
				break;
			}

			case Bytecode.CONVERT_B: {
				ins = (new Instruction(oldi, z, null, 0));

				if (last) {
					switch (last.name) {
						case Bytecode.EQUALS:
						case Bytecode.STRICTEQUALS:
						case Bytecode.GREATERTHAN:
						case Bytecode.GREATEREQUALS:
						case Bytecode.LESSTHAN:
						case Bytecode.LESSEQUALS:
						case Bytecode.NOT:
						{
							ins.name = Bytecode.LABEL;
							ins.comment = 'IR: CONVERT_B removed, reason: arguments strictly boolean';
							break;
						}
					}
				}
				break;
			}

			case Bytecode.ESC_XATTR:
			case Bytecode.ESC_XELEM:
			case Bytecode.CONVERT_I:
			case Bytecode.CONVERT_U:
			case Bytecode.CONVERT_S:
			case Bytecode.CONVERT_O:
				ins = (new Instruction(oldi, z, null, 0));
				break;
			case Bytecode.CHECKFILTER:
				ins = (new Instruction(oldi, z, null, 0));
				break;
			case Bytecode.GETLOCAL:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, u30(state), 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL0:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, 0, 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL1:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, 1, 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL2:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, 2, 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL3:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, 3, 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, u30(state), -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL0:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, 0, -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL1:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, 1, -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL2:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, 2, -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL3:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, 3, -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.KILL:
				ins = (new Instruction(oldi, z, u30(state), 0));
				ins.name = Bytecode.LABEL;
				ins.comment = 'IR: KILL removed, reason: prevent optimisation';
				break;

			case Bytecode.GETLEX: {
				const [index, dyn, d] = mn(state);
				ins = (new Instruction(oldi, z + dyn, index, 1 + d));
				ins.returnTypeId = lastType = ++type;
				requireScope = true;
				break;
			}

			//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#si32()
			case Bytecode.SI8:
			case Bytecode.SI16:
			case Bytecode.SI32:
			case Bytecode.SF32:
			case Bytecode.SF64:
				ins = (new Instruction(oldi, z, null, -2));
				break;

			//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#li32()
			case Bytecode.LI8:
			case Bytecode.LI16:
			case Bytecode.LI32:
			case Bytecode.LF32:
			case Bytecode.LF64:
				ins = (new Instruction(oldi, z, null, 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;
				break;
			default: {
				const c = code[state.index - 1];
				return {
					error: {
						message: `UNKNOWN BYTECODE ${c.toString(16)} ${Bytecode[c]} at ${oldi}`,
						reason: COMPILATION_FAIL_REASON.UNKNOW_BYTECODE,
					}
				} as any;
			}
		}

		q.push(ins);
	}

	let minStack = propagateStack(0, 0, q);

	if (requireScope) {
		propagateScope(0, 0, q);
	} else {

		const scopeIndexes = [];
		for (let i = 0; i < q.length; i++) {
			if (q[i].name === Bytecode.PUSHSCOPE) {
				scopeIndexes.push(i);
			}
		}

		for (const i of scopeIndexes) {
			// we remove 3 commands, because push scope shift stack before
			const comment = new Instruction(0, Bytecode.LABEL);
			comment.comment = 'IR: PUSHSCOPE removed, reason: unused';

			q.splice(i - 1, 2, comment);
		}
	}

	const jumps: number[] = [0];

	for (let i = 0; i < q.length; i++) {
		for (let j = 0; j < q[i].refs.length; j++) {
			jumps.push(q[i].refs[j]);
		}
	}

	let catchStart: NumberMap<ExceptionInfo[]>;
	let catchEnd: NumberMap<ExceptionInfo[]>;

	if (body.catchBlocks.length) {
		// collect try-catch blocks sorted by their start-position
		catchStart = {};
		// collect try-catch blocks sorted by their end-position
		catchEnd = {};
		for (let i: number = 0; i < body.catchBlocks.length; i++) {
			const block = body.catchBlocks[i];

			//let stack = 0;
			let start = -1;
			let end = -1;
			let scope = 0;

			for (let c: number = 0; c < q.length; c++) {
				const pos = q[c].position;

				if (pos >= block.start) {
					start = pos;
					break;
				}

				// propogade it
				// stack = q[c].stack;
				if (!Settings.NO_PROPAGATE_SCOPES_FOR_TRY)
					scope = q[c].scope;
			}

			for (let c: number = q.length - 1; c >= 0; c--) {
				const pos = q[c].position;

				if (pos <= block.end) {
					end = pos;
					break;
				}
			}

			if (!catchStart[start])
				catchStart[start] = [];
			catchStart[start].push(block);

			if (!catchEnd[end])
				catchEnd[end] = [];
			catchEnd[end].push(block);

			// make sure that the target-instruction for the catch is propagated and set as target
			// using the stack value of the start-instruction does seem to do the trick
			// and this broadcast bug, if breakpoints is exist

			// IMPORTANT! Catch block push error on top of stack
			// this is why stack should start from 1 instead of 0

			const s = propagateStack(block.target, 1, q);
			if (s < minStack) minStack = s;

			// IMPORTANT! SCOPE SHOULD BE PROPOGADED TOO
			propagateScope(block.target, scope, q);

			jumps.push(block.target);
		}
	}

	propogateTree(q, jumps);

	const error = minStack < 0 ? {
		message: 'Stack underrun while preprocess, stack:' + minStack,
		reason: COMPILATION_FAIL_REASON.UNDERRUN
	} : null;

	return {
		set: q,
		jumps,
		catchStart,
		catchEnd,
		error
	};
}