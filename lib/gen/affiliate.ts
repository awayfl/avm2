
import {Bytecode} from "./../Bytecode";
import { ExceptionInfo } from './../abc/lazy/ExceptionInfo'
import { MethodInfo } from "./../abc/lazy/MethodInfo"

const BytecodeName = Bytecode

const DEFAULT_STACK_INDEX = -1024;

export class Instruction {
	public stack: number = DEFAULT_STACK_INDEX
	public scope: number = DEFAULT_STACK_INDEX
	public catchBlock: ExceptionInfo;
	public catchStart: boolean = false;
	public catchEnd: boolean = false;

	constructor(
		readonly position: number, 
		readonly name: Bytecode, 
		readonly params: Array<any> = [], 
		readonly delta: number = 0, 
		readonly deltaScope: number = 0, 
		readonly terminal: boolean = false, 
		readonly refs: Array<number> = []) {
	}

	toString() {
		return `Instruction(${this.position}, ${BytecodeName[this.name]} (${this.name}), [${this.params}], ${this.stack} -> ${this.stack + this.delta}, ${this.scope} -> ${this.scope + this.deltaScope}, ${this.terminal}, [${this.refs}])`
	}
}
export interface IAffilerError {
	error: string;
}

export interface IAffilerResult {
	jumps: Array<number>;
	set: Array<Instruction>;
	catchStart: NumberMap<ExceptionInfo[]>,
	catchEnd: NumberMap<ExceptionInfo[]>
}
/**
 * Propogade stack for calculation real stack size for every instruction
 */
export function propagateStack(position: number, stack: number, q: Array<Instruction>) {
	let v = stack;
	let l = q.length;

	for (let i = 0; i < l; i++) {
		if (q[i].position >= position) {
			if (q[i].stack >= 0)
				return

			q[i].stack = v;
			v += q[i].delta;

			for (let j = 0; j < q[i].refs.length; j++) {
				propagateStack(q[i].refs[j], v, q)
			}

			if (q[i].terminal)
				return
		}
	}
}

/**
 * Like as propogadeStack, only for scope
 */
export function propagateScope (position: number, scope: number, q: Array<Instruction>) {
	let v = scope;
	let l = q.length;
	for (let i = 0; i < l; i++) {
		if (q[i].position >= position) {
			if (q[i].scope >= 0)
				return;

			q[i].scope = v
			v += q[i].deltaScope

			for (let j = 0; j < q[i].refs.length; j++){
				propagateScope(q[i].refs[j], v, q)
			}

			if (q[i].terminal)
				return
		}
	}
}


/**
 * Affilate instruction set from method info
 * @param methodInfo 
 */
export function affilate(methodInfo: MethodInfo): IAffilerResult & IAffilerError {
	const abc = methodInfo.abc;
	const body = methodInfo.getBody();
	const code = body.code;

	let q: Instruction[] = []

	for (let i: number = 0; i < code.length;) {
		let u30 = function (): number {
			let u = code[i++]
			if (u & 0x80) {
				u = u & 0x7f | code[i++] << 7
				if (u & 0x4000) {
					u = u & 0x3fff | code[i++] << 14
					if (u & 0x200000) {
						u = u & 0x1fffff | code[i++] << 21
						if (u & 0x10000000) {
							u = u & 0x0fffffff | code[i++] << 28
							u = u & 0xffffffff
						}
					}
				}
			}
			return u >>> 0
		}

		let mn = function () {
			let index = u30()
			let name = abc.getMultiname(index)

			if (name.isRuntimeName() || name.isRuntimeNamespace())
				return [index, 256, name.isRuntimeName() && name.isRuntimeNamespace()? -2 : -1]

			return [index, 0, 0]
		}

		let s24 = function (): number {
			let u = code[i++] | (code[i++] << 8) | (code[i++] << 16)
			return (u << 8) >> 8
		}

		let s8 = function (): number {
			let u = code[i++]
			return (u << 24) >> 24
		}

		let oldi = i

		const z = code[i++]
		switch (z) {
			case Bytecode.LABEL:
				q.push(new Instruction(oldi, z))
				break
			case Bytecode.DXNSLATE:
				q.push(new Instruction(oldi, z, [0], -1))
				break
			case Bytecode.DEBUGFILE:
				q.push(new Instruction(oldi, z, [u30()]))
				break

			case Bytecode.DEBUGLINE:
				q.push(new Instruction(oldi, z, [u30()]))
				break

			case Bytecode.DEBUG:
				q.push(new Instruction(oldi, z, [s8(), u30(), s8(), u30()]))
				break

			case Bytecode.THROW:
				q.push(new Instruction(oldi, z, [], -1, 0, true))
				break


			case Bytecode.PUSHSCOPE:
				q.push(new Instruction(oldi, z, [], -1, 1))
				break

			case Bytecode.PUSHWITH:
				q.push(new Instruction(oldi, z, [], -1, 1))
				break

			case Bytecode.POPSCOPE:
				q.push(new Instruction(oldi, z, [], 0, -1))
				break

			case Bytecode.GETSCOPEOBJECT:
				q.push(new Instruction(oldi, z, [s8()], 1, 0))
				break

			case Bytecode.GETGLOBALSCOPE:
				q.push(new Instruction(oldi, z, [], 1))
				break

			case Bytecode.GETSLOT:
				q.push(new Instruction(oldi, z, [u30()], 0))
				break

			case Bytecode.SETSLOT:
				q.push(new Instruction(oldi, z, [u30()], -2))
				break
			case Bytecode.NEXTNAME:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.NEXTVALUE:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.HASNEXT:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.HASNEXT2:
				q.push(new Instruction(oldi, z, [u30(), u30()], 1))
				break

			case Bytecode.IN:
				q.push(new Instruction(oldi, z, [], -1))
				break


			case Bytecode.DUP:
				q.push(new Instruction(oldi, z, [], 1))
				break

			case Bytecode.POP:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.SWAP:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.PUSHTRUE:
				q.push(new Instruction(oldi, z, [], 1))
				break

			case Bytecode.PUSHFALSE:
				q.push(new Instruction(oldi, z, [], 1))
				break

			case Bytecode.PUSHBYTE:
				q.push(new Instruction(oldi, z, [s8()], 1))
				break

			case Bytecode.PUSHSHORT:
				q.push(new Instruction(oldi, z, [u30() << 16 >> 16], 1))
				break

			case Bytecode.PUSHINT:
				q.push(new Instruction(oldi, z, [u30()], 1))
				break

			case Bytecode.PUSHUINT:
				q.push(new Instruction(oldi, z, [u30()], 1))
				break

			case Bytecode.PUSHDOUBLE:
				q.push(new Instruction(oldi, z, [u30()], 1))
				break

			case Bytecode.PUSHNAN:
				q.push(new Instruction(oldi, z, [], 1))
				break

			case Bytecode.PUSHNULL:
				q.push(new Instruction(oldi, z, [], 1))
				break

			case Bytecode.PUSHUNDEFINED:
				q.push(new Instruction(oldi, z, [], 1))
				break

			case Bytecode.PUSHSTRING:
				q.push(new Instruction(oldi, z, [u30()], 1))
				break

			case Bytecode.IFEQ:
				var j = s24()
				q.push(new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]))
				break

			case Bytecode.IFNE:
				var j = s24()
				q.push(new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]))
				break

			case Bytecode.IFSTRICTEQ:
				var j = s24()
				q.push(new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]))
				break
			case Bytecode.IFSTRICTNE:
				var j = s24()
				q.push(new Instruction(oldi, z, [i + j], -2, 0, false, [i + j]))
				break

			case Bytecode.IFGT:
			case Bytecode.IFNLE:
				var j = s24()
				q.push(new Instruction(oldi, Bytecode.IFGT, [i + j], -2, 0, false, [i + j]))
				break

			case Bytecode.IFGE:
			case Bytecode.IFNLT:
				var j = s24()
				q.push(new Instruction(oldi, Bytecode.IFGE, [i + j], -2, 0, false, [i + j]))
				break

			case Bytecode.IFLT:
			case Bytecode.IFNGE:
				var j = s24()
				q.push(new Instruction(oldi, Bytecode.IFLT, [i + j], -2, 0, false, [i + j]))
				break

			case Bytecode.IFLE:
			case Bytecode.IFNGT:
				var j = s24()
				q.push(new Instruction(oldi, Bytecode.IFLE, [i + j], -2, 0, false, [i + j]))
				break

			case Bytecode.IFTRUE:
				var j = s24()
				q.push(new Instruction(oldi, z, [i + j], -1, 0, false, [i + j]))
				break

			case Bytecode.IFFALSE:
				var j = s24()
				q.push(new Instruction(oldi, z, [i + j], -1, 0, false, [i + j]))
				break


			case Bytecode.LOOKUPSWITCH:
				var offset = oldi + s24()
				var cases = u30()

				var table = [offset]

				for (let j = 0; j <= cases; j++)
					table.push(oldi + s24())

				q.push(new Instruction(oldi, z, table, -1, 0, true, table))
				break

			case Bytecode.JUMP:
				var j = s24()
				q.push(new Instruction(oldi, z, [i + j], 0, 0, true, [i + j]))
				break


			case Bytecode.RETURNVALUE:
				q.push(new Instruction(oldi, z, [], -1, 0, true))
				break

			case Bytecode.RETURNVOID:
				q.push(new Instruction(oldi, z, [], 0, 0, true))
				break


			case Bytecode.NOT:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.BITNOT:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.NEGATE:
				q.push(new Instruction(oldi, z, [], 0))
				break


			case Bytecode.INCREMENT:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.DECREMENT:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.INCLOCAL:
				q.push(new Instruction(oldi, z, [u30()], 0))
				break

			case Bytecode.DECLOCAL:
				q.push(new Instruction(oldi, z, [u30()], 0))
				break

			case Bytecode.INCREMENT_I:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.DECREMENT_I:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.INCLOCAL_I:
				q.push(new Instruction(oldi, z, [u30()], 0))
				break

			case Bytecode.DECLOCAL_I:
				q.push(new Instruction(oldi, z, [u30()], 0))
				break

			case Bytecode.NEGATE_I:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.ADD_I:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.SUBTRACT_I:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.MULTIPLY_I:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.ADD:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.SUBTRACT:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.MULTIPLY:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.DIVIDE:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.MODULO:
				q.push(new Instruction(oldi, z, [], -1))
				break


			case Bytecode.LSHIFT:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.RSHIFT:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.URSHIFT:
				q.push(new Instruction(oldi, z, [], -1))
				break


			case Bytecode.BITAND:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.BITOR:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.BITXOR:
				q.push(new Instruction(oldi, z, [], -1))
				break


			case Bytecode.EQUALS:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.STRICTEQUALS:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.GREATERTHAN:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.GREATEREQUALS:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.LESSTHAN:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.LESSEQUALS:
				q.push(new Instruction(oldi, z, [], -1))
				break

			case Bytecode.TYPEOF:
				q.push(new Instruction(oldi, z, [], 0))
				break

			case Bytecode.INSTANCEOF:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.ISTYPE:				
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z, [index], 0 + d))
				break
			case Bytecode.ISTYPELATE:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.ASTYPELATE:
				q.push(new Instruction(oldi, z, [], -1))
				break
			case Bytecode.ASTYPE:				
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z, [index], 0 + d))
				break
			case Bytecode.CALL:
				var argnum = u30()
				q.push(new Instruction(oldi, z, [argnum], -argnum - 1))
				break
			case Bytecode.CONSTRUCT:
				var argnum = u30()
				q.push(new Instruction(oldi, z, [argnum, index], -argnum))
				break
			case Bytecode.CALLPROPERTY:
				var [index, dyn, d] = mn()
				var argnum = u30()
				q.push(new Instruction(oldi, z + dyn, [argnum, index], -argnum + d))
				break
			case Bytecode.CALLPROPLEX:
				var [index, dyn, d] = mn()
				var argnum = u30()
				q.push(new Instruction(oldi, z + dyn, [argnum, index], -argnum + d))
				break
			case Bytecode.CALLPROPVOID:
				var [index, dyn, d] = mn()
				var argnum = u30()
				q.push(new Instruction(oldi, z + dyn, [argnum, index], -(argnum + 1) + d))
				break
			case Bytecode.APPLYTYPE:
				var argnum = u30()
				q.push(new Instruction(oldi, z, [argnum], -argnum))
				break


			case Bytecode.FINDPROPSTRICT:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z + dyn, [index], 1 + d))
				break
			case Bytecode.FINDPROPERTY:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z + dyn, [index], 1 + d))
				break
			case Bytecode.NEWFUNCTION:
				q.push(new Instruction(oldi, z, [u30()], 1));
				break
			case Bytecode.NEWCLASS:
				q.push(new Instruction(oldi, z, [u30()], 0))
				break
			case Bytecode.NEWARRAY:
				var argnum = u30()
				q.push(new Instruction(oldi, z, [argnum], -argnum + 1))
				break
			case Bytecode.NEWOBJECT:
				var argnum = u30()
				q.push(new Instruction(oldi, z, [argnum], -2 * argnum + 1))
				break
			case Bytecode.NEWACTIVATION:
				q.push(new Instruction(oldi, z, [], 1))
				break
			case Bytecode.NEWCATCH:
				q.push(new Instruction(oldi, z, [u30()], 1))
				break


			case Bytecode.CONSTRUCTSUPER:
				var argnum = u30()
				q.push(new Instruction(oldi, z, [argnum], -(argnum + 1)))
				break
			case Bytecode.CALLSUPER:
				var [index, dyn, d] = mn()
				var argnum = u30()
				q.push(new Instruction(oldi, z + dyn, [argnum, index], -argnum + d))
				break
			case Bytecode.CALLSUPERVOID:
				var [index, dyn, d] = mn()
				var argnum = u30()
				q.push(new Instruction(oldi, z + dyn, [argnum, index], -(argnum + 1) + d))
				break


			case Bytecode.CONSTRUCTPROP:
				var [index, dyn, d] = mn()
				var argnum = u30()
				q.push(new Instruction(oldi, z + dyn, [argnum, index], -argnum + d))
				break


			case Bytecode.GETPROPERTY:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, Bytecode.GETPROPERTY + dyn, [index], 0 + d))
				break
			case Bytecode.INITPROPERTY:
			case Bytecode.SETPROPERTY:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, Bytecode.SETPROPERTY + dyn, [index], -2 + d))
				break
			case Bytecode.DELETEPROPERTY:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z + dyn, [index], 0 + d))



			case Bytecode.GETSUPER:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z + dyn, [index], 0 + d))
				break
			case Bytecode.SETSUPER:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z + dyn, [index], -2 + d))
				break


			case Bytecode.COERCE:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z + dyn, [index], 0 + d))
				break
			case Bytecode.COERCE_A:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.COERCE_S:
				q.push(new Instruction(oldi, z, [], 0))
				break


			case Bytecode.CONVERT_I:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.CONVERT_D:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.CONVERT_B:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.CONVERT_U:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.CONVERT_S:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.CONVERT_O:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.CHECKFILTER:
				q.push(new Instruction(oldi, z, [], 0))
				break
			case Bytecode.GETLOCAL:
				q.push(new Instruction(oldi, Bytecode.GETLOCAL, [u30()], 1))
				break
			case Bytecode.GETLOCAL0:
				q.push(new Instruction(oldi, Bytecode.GETLOCAL, [0], 1))
				break
			case Bytecode.GETLOCAL1:
				q.push(new Instruction(oldi, Bytecode.GETLOCAL, [1], 1))
				break
			case Bytecode.GETLOCAL2:
				q.push(new Instruction(oldi, Bytecode.GETLOCAL, [2], 1))
				break
			case Bytecode.GETLOCAL3:
				q.push(new Instruction(oldi, Bytecode.GETLOCAL, [3], 1))
				break
			case Bytecode.SETLOCAL:
				q.push(new Instruction(oldi, Bytecode.SETLOCAL, [u30()], -1))
				break
			case Bytecode.SETLOCAL0:
				q.push(new Instruction(oldi, Bytecode.SETLOCAL, [0], -1))
				break
			case Bytecode.SETLOCAL1:
				q.push(new Instruction(oldi, Bytecode.SETLOCAL, [1], -1))
				break
			case Bytecode.SETLOCAL2:
				q.push(new Instruction(oldi, Bytecode.SETLOCAL, [2], -1))
				break
			case Bytecode.SETLOCAL3:
				q.push(new Instruction(oldi, Bytecode.SETLOCAL, [3], -1))
				break
			case Bytecode.KILL:
				q.push(new Instruction(oldi, z, [u30()], 0))
				break

			case Bytecode.GETLEX:
				var [index, dyn, d] = mn()
				q.push(new Instruction(oldi, z + dyn, [index], 1 + d))
				break

			//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#si32()
			case Bytecode.SI8:
			case Bytecode.SI16:
			case Bytecode.SI32:
			case Bytecode.SF32:
			case Bytecode.SF64:
				q.push(new Instruction(oldi, z, [], -2))
				break;
			
			//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#li32()
			case Bytecode.LI8:
			case Bytecode.LI16:
			case Bytecode.LI32:
			case Bytecode.LF32:
			case Bytecode.LF64:
				q.push(new Instruction(oldi, z, [], 0))
				break;
			default:
				//console.log(`UNKNOWN BYTECODE ${code[i - 1].toString(16)} ${BytecodeName[code[i - 1]]} at ${oldi} (method:`, methodInfo.index());
				return { error: `UNKNOWN BYTECODE ${code[i - 1].toString(16)} ${BytecodeName[code[i - 1]]} at ${oldi}` } as any;
		}

	}

	propagateStack(0, 0, q);
	propagateScope(0, 0, q);

	const jumps: number[] = [0];

	for (let i = 0; i < q.length; i++){
		for (let j = 0; j < q[i].refs.length; j++){
			jumps.push(q[i].refs[j])
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
			
			let stack = 0;
			let start = -1;
			let end = -1;
			let scope = 0;

			for (let c: number = 0; c < q.length; c++) {
				const pos = q[c].position;
				
				if ( pos > block.start) {
					start = pos;
					break;
				}
				
				// propogade it
				stack = q[c].stack;
				scope = q[c].scope;
			}

			for (let c: number = q.length - 1; c >=0; c--) {
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

			propagateStack(block.target, stack + 1, q);
			// IMPORTANT! SCOPE SHOULD BE PROPOGADED TOO
			propagateScope(block.target, scope, q);

			jumps.push(block.target)
		}
	}

	return {
		set: q,
		jumps,
		catchStart,
		catchEnd,
		error: undefined
	};
}