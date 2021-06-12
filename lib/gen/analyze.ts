import { Bytecode } from '../Bytecode';
import { ExceptionInfo } from '../abc/lazy/ExceptionInfo';
import { MethodInfo } from '../abc/lazy/MethodInfo';
import { Instruction } from './Instruction';
import { COMPILATION_FAIL_REASON } from '../flags';
import { Settings } from '../Settings';

const BytecodeName = Bytecode;

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
			const params = c.params;
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

/**
 * Analyzing instruction set from method info
 * @param methodInfo
 */
export function analyze(methodInfo: MethodInfo): IAnalyseResult | IAnalyzeError {
	const abc = methodInfo.abc;
	const body = methodInfo.getBody();
	const code = body.code;

	const q: Instruction[] = [];
	let type: number = 0;
	let lastType: number = 0;

	for (let i: number = 0; i < code.length;) {
		const u30 = function (): number {
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
			return u >>> 0;
		};

		const mn = function () {
			const index = u30();
			const name = abc.getMultiname(index);

			if (name.isRuntimeName() || name.isRuntimeNamespace())
				return [index, 256, name.isRuntimeName() && name.isRuntimeNamespace() ? -2 : -1];

			return [index, 0, 0];
		};

		const s24 = function (): number {
			const u = code[i++] | (code[i++] << 8) | (code[i++] << 16);
			return (u << 8) >> 8;
		};

		const s8 = function (): number {
			const u = code[i++];
			return (u << 24) >> 24;
		};

		const oldi = i;

		const z = code[i++];
		const last = Settings.OPTIMISE_ON_IR ?  q[q.length - 1] : null;
		let ins: Instruction;

		switch (z) {
			case Bytecode.LABEL:
				ins = (new Instruction(oldi, z));
				break;
			case Bytecode.DXNSLATE:
				ins = (new Instruction(oldi, z, [0], -1));
				break;
			case Bytecode.DEBUGFILE:
			case Bytecode.DEBUGLINE:

				ins = (new Instruction(oldi, z, [u30()]));
				break;

			case Bytecode.DEBUG:
				ins = (new Instruction(oldi, z, [s8(), u30(), s8(), u30()]));
				break;

			case Bytecode.THROW:
				ins = (new Instruction(oldi, z, [], -1, 0, true));
				break;

			case Bytecode.PUSHSCOPE:
				ins = (new Instruction(oldi, z, [], -1, 1));
				ins.returnTypeId = lastType =  ++type;
				break;

			case Bytecode.PUSHWITH:
				ins = (new Instruction(oldi, z, [], -1, 1));
				break;

			case Bytecode.POPSCOPE:
				ins = (new Instruction(oldi, z, [], 0, -1));
				break;

			case Bytecode.GETSCOPEOBJECT:
				ins = (new Instruction(oldi, z, [s8()], 1, 0));
				ins.returnTypeId = lastType =  ++type;
				break;

			case Bytecode.GETGLOBALSCOPE:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  ++type;

				break;

			case Bytecode.GETSLOT:
				ins = (new Instruction(oldi, z, [u30()], 0));
				ins.returnTypeId = lastType =  ++type;

				break;

			case Bytecode.SETSLOT:
				ins = (new Instruction(oldi, z, [u30()], -2));
				break;

			case Bytecode.NEXTNAME:
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  ++type;

				break;

			case Bytecode.NEXTVALUE:
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  ++type;

				break;

			case Bytecode.HASNEXT:
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.HASNEXT2:
				ins = (new Instruction(oldi, z, [u30(), u30()], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.IN:
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.DUP:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  type;

				break;

			case Bytecode.POP: {
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType = type;

				//
				if (last && last.name === Bytecode.CALLPROPERTY) {
					last.name = Bytecode.CALLPROPVOID;
					last.comment = 'IR: Optimised from "CALLPROPERTY", reason: POP STACK';
				}
				break;
			}
			case Bytecode.SWAP:
				ins = (new Instruction(oldi, z, [], 0));
				break;

			case Bytecode.PUSHTRUE:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;
				break;

			case Bytecode.PUSHFALSE:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;

			case Bytecode.PUSHBYTE:
				ins = (new Instruction(oldi, z, [s8()], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHSHORT:
				ins = (new Instruction(oldi, z, [u30() << 16 >> 16], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHINT:
				ins = (new Instruction(oldi, z, [u30()], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHUINT:
				ins = (new Instruction(oldi, z, [u30()], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHDOUBLE:
				ins = (new Instruction(oldi, z, [u30()], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHNAN:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.PUSHNULL:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NULL;

				break;

			case Bytecode.PUSHUNDEFINED:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.UNDEF;

				break;

			case Bytecode.PUSHSTRING:
				ins = (new Instruction(oldi, z, [u30()], 1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.STRING;

				break;

			case Bytecode.IFEQ: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFNE: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFSTRICTEQ: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFSTRICTNE: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFGT:
			case Bytecode.IFNLE: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFGE:
			case Bytecode.IFNLT: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFLT:
			case Bytecode.IFNGE: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFLE:
			case Bytecode.IFNGT: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFTRUE: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -1, 0, false, [i + j]));
				break;
			}
			case Bytecode.IFFALSE: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], -1, 0, false, [i + j]));
				break;
			}
			case Bytecode.LOOKUPSWITCH: {
				const offset = oldi + s24();
				const cases = u30();

				const table = [offset];

				for (let j = 0; j <= cases; j++)
					table.push(oldi + s24());

				ins = (new Instruction(oldi, z, table, -1, 0, true, table));
				break;
			}
			case Bytecode.JUMP: {
				const j = s24();
				ins = (new Instruction(oldi, z, [i + j], 0, 0, true, [i + j]));
				break;
			}
			case Bytecode.RETURNVALUE:
				ins = (new Instruction(oldi, z, [], -1, 0, true));
				break;

			case Bytecode.RETURNVOID:
				ins = (new Instruction(oldi, z, [], 0, 0, true));
				break;

			case Bytecode.NOT:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;
				break;

			case Bytecode.BITNOT:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.NEGATE:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.INCREMENT:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.DECREMENT:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.INCLOCAL:
			case Bytecode.DECLOCAL:
				ins = (new Instruction(oldi, z, [u30()], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;
				break;

			case Bytecode.INCREMENT_I:
			case Bytecode.DECREMENT_I:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.INCLOCAL_I:
			case Bytecode.DECLOCAL_I:
				ins = (new Instruction(oldi, z, [u30()], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;

			case Bytecode.NEGATE_I:
				ins = (new Instruction(oldi, z, [], 0));
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
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;

				break;
			case Bytecode.EQUALS:
			case Bytecode.STRICTEQUALS:
			case Bytecode.GREATERTHAN:
			case Bytecode.GREATEREQUALS:
			case Bytecode.LESSTHAN:
			case Bytecode.LESSEQUALS:
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;
				break;

			case Bytecode.TYPEOF:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.INSTANCEOF:
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;
			case Bytecode.ISTYPE:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z, [index], 0 + d));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;
			case Bytecode.ISTYPELATE:
				ins = (new Instruction(oldi, z, [], -1));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.BOOL;

				break;
			case Bytecode.ASTYPELATE:
				ins = (new Instruction(oldi, z, [], -1));

				break;
			case Bytecode.ASTYPE:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z, [index], 0 + d));
				break;
			case Bytecode.CALL:
				var argnum = u30();
				ins = (new Instruction(oldi, z, [argnum], -argnum - 1));
				break;
			case Bytecode.CONSTRUCT:
				var argnum = u30();
				ins = (new Instruction(oldi, z, [argnum, index], -argnum));
				ins.returnTypeId = lastType =  ++type;
				break;
			case Bytecode.CALLPROPERTY:
				var [index, dyn, d] = mn();
				var argnum = u30();
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.CALLPROPLEX:
				var [index, dyn, d] = mn();
				var argnum = u30();
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.CALLPROPVOID:
				var [index, dyn, d] = mn();
				var argnum = u30();
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -(argnum + 1) + d));
				break;
			case Bytecode.APPLYTYPE:
				var argnum = u30();
				ins = (new Instruction(oldi, z, [argnum], -argnum));
				ins.returnTypeId = lastType =  type;

				break;
			case Bytecode.FINDPROPSTRICT:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z + dyn, [index], 1 + d));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.FINDPROPERTY:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z + dyn, [index], 1 + d));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.NEWFUNCTION:
				ins = (new Instruction(oldi, z, [u30()], 1));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.NEWCLASS:
				ins = (new Instruction(oldi, z, [u30()], 0));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.GETDESCENDANTS:
				ins = (new Instruction(oldi, z, [u30()], 0));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.NEWARRAY:
				var argnum = u30();
				ins = (new Instruction(oldi, z, [argnum], -argnum + 1));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.NEWOBJECT:
				var argnum = u30();
				ins = (new Instruction(oldi, z, [argnum], -2 * argnum + 1));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.NEWACTIVATION:
				ins = (new Instruction(oldi, z, [], 1));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.NEWCATCH:
				ins = (new Instruction(oldi, z, [u30()], 1));
				break;

			case Bytecode.CONSTRUCTSUPER:
				var argnum = u30();
				ins = (new Instruction(oldi, z, [argnum], -(argnum + 1)));

				break;
			case Bytecode.CALLSUPER:
				var [index, dyn, d] = mn();
				var argnum = u30();
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				break;
			case Bytecode.CALLSUPERVOID:
				var [index, dyn, d] = mn();
				var argnum = u30();
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -(argnum + 1) + d));
				break;

			case Bytecode.CONSTRUCTPROP:
				var [index, dyn, d] = mn();
				var argnum = u30();
				ins = (new Instruction(oldi, z + dyn, [argnum, index], -argnum + d));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.GETPROPERTY:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, Bytecode.GETPROPERTY + dyn, [index], 0 + d));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.INITPROPERTY:
			case Bytecode.SETPROPERTY:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, Bytecode.SETPROPERTY + dyn, [index], -2 + d));

				break;
			case Bytecode.DELETEPROPERTY:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z + dyn, [index], 0 + d));
				break;
			case Bytecode.GETSUPER:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z + dyn, [index], 0 + d));
				ins.returnTypeId = lastType =  ++type;

				break;
			case Bytecode.SETSUPER:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z + dyn, [index], -2 + d));
				break;

			case Bytecode.COERCE:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z + dyn, [index], 0 + d));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.COERCE_A:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.COERCE_S:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = PRIMITIVE_TYPE.STRING;

				break;
			case Bytecode.ESC_XATTR:
			case Bytecode.ESC_XELEM:
			case Bytecode.CONVERT_I:
			case Bytecode.CONVERT_D:
			case Bytecode.CONVERT_B:
			case Bytecode.CONVERT_U:
			case Bytecode.CONVERT_S:
			case Bytecode.CONVERT_O:
				ins = (new Instruction(oldi, z, [], 0));
				break;
			case Bytecode.CHECKFILTER:
				ins = (new Instruction(oldi, z, [], 0));
				break;
			case Bytecode.GETLOCAL:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, [u30()], 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL0:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, [0], 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL1:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, [1], 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL2:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, [2], 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.GETLOCAL3:
				ins = (new Instruction(oldi, Bytecode.GETLOCAL, [3], 1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, [u30()], -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL0:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, [0], -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL1:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, [1], -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL2:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, [2], -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.SETLOCAL3:
				ins = (new Instruction(oldi, Bytecode.SETLOCAL, [3], -1));
				ins.returnTypeId = lastType;

				break;
			case Bytecode.KILL:
				ins = (new Instruction(oldi, z, [u30()], 0));
				break;

			case Bytecode.GETLEX:
				var [index, dyn, d] = mn();
				ins = (new Instruction(oldi, z + dyn, [index], 1 + d));
				ins.returnTypeId = lastType =  ++type;

				break;

			//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#si32()
			case Bytecode.SI8:
			case Bytecode.SI16:
			case Bytecode.SI32:
			case Bytecode.SF32:
			case Bytecode.SF64:
				ins = (new Instruction(oldi, z, [], -2));
				break;

			//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#li32()
			case Bytecode.LI8:
			case Bytecode.LI16:
			case Bytecode.LI32:
			case Bytecode.LF32:
			case Bytecode.LF64:
				ins = (new Instruction(oldi, z, [], 0));
				ins.returnTypeId = lastType =  PRIMITIVE_TYPE.NUMBER;
				break;
			default:
				return {
					error: {
						message: `UNKNOWN BYTECODE ${code[i - 1].toString(16)} ${BytecodeName[code[i - 1]]} at ${oldi}`,
						reason: COMPILATION_FAIL_REASON.UNKNOW_BYTECODE,
					}
				} as any;
		}

		q.push(ins);
	}

	let minStack = propagateStack(0, 0, q);
	propagateScope(0, 0, q);

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