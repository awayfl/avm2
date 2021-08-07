/* eslint-disable no-fallthrough */
import { assert } from '@awayjs/graphics';
import { Scope } from './run/Scope';
import { HasNext2Info } from './run/HasNext2Info';
import { AXSecurityDomain } from './run/AXSecurityDomain';
import { validateCall } from './run/validateCall';
import { validateConstruct } from './run/validateConstruct';
import { axCoerceString } from './run/axCoerceString';
import { axCheckFilter } from './run/axCheckFilter';
import { isNumeric, jsGlobal, release } from '@awayfl/swf-loader';
import { Multiname } from './abc/lazy/Multiname';
import { CONSTANT } from './abc/lazy/CONSTANT';
import { MethodInfo } from './abc/lazy/MethodInfo';
import { internNamespace } from './abc/lazy/internNamespace';
import { AXClass, IS_AX_CLASS } from './run/AXClass';
import { axCoerceName } from './run/axCoerceName';
import { ABCFile } from './abc/lazy/ABCFile';
import { ScriptInfo } from './abc/lazy/ScriptInfo';
import { ExceptionInfo } from './abc/lazy/ExceptionInfo';
import { Bytecode } from './Bytecode';
import { ASObject } from './nat/ASObject';
import { escapeAttributeValue, escapeElementValue } from './natives/xml';
import { COMPILATION_FAIL_REASON, COMPILER_DEFAULT_OPT, COMPILER_OPT_FLAGS } from './flags';

// generators
import { analyze, IAnalyseResult, IAnalyzeError } from './gen/analyze';
import { TinyConstructor } from './gen/TinyConstructor';
import { ICallEntry } from './gen/FastCall';

import { Stat } from './gen/Stat';

import { ComplexGenerator, PhysicsLex, StaticHoistLex, TopLevelLex } from './gen/LexImportsGenerator';

import {
	emitAnnotation,
	emitAnnotationOld,
	emitCloseTryCatch,
	emitDomainMemOppcodes,
	emitInlineAccessor as emitAccess,
	emitInlineLocal,
	emitInlineMultiname,
	emitInlineStack,
	emitOpenTryCatch,
	emitPrimitiveCoerce,
	isPrimitiveType,
	UNDERRUN
} from './gen/emiters';

import {
	emitIsAX,
	emitIsAXOrPrimitive,
	extClassConstructor,
	getExtClassField,
	IS_EXTERNAL_CLASS,
	needFastCheck
} from './ext/external';
import { AXCallable } from './run/AXCallable';
import { ASClass } from './nat/ASClass';
import { AXObject } from './run/AXObject';
import { COERCE_MODE_ENUM, COERCE_RETURN_MODE_ENUM, Settings } from './Settings';
import { AXFunction } from './run/AXFunction';
import { CompilerState } from './gen/CompilerState';
import { Instruction } from './gen/Instruction';
import { TRAIT, TRAITNames } from './abc/lazy/TRAIT';
import { InstanceInfo } from './abc/lazy/InstanceInfo';
import { SlotTraitInfo } from './abc/lazy/SlotTraitInfo';
import { AXApplicationDomain } from './run/AXApplicationDomain';
import { TraitInfo } from './abc/lazy/TraitInfo';
import { RuntimeTraitInfo } from './abc/lazy/RuntimeTraitInfo';
import { axConstructFast, isFastConstructSupport } from './run/axConstruct';

const METHOD_HOOKS: StringMap<{path: string, place: 'begin' | 'return', hook: Function}> = {};

export const BytecodeName = Bytecode;
/**
 * Try resolve method and attach hook to it
 */
export function UNSAFE_attachMethodHook(
	path: string,
	place: 'begin' | 'return' = 'begin',
	hook: Function) {
	if (!path || typeof hook !== 'function') {
		throw 'Hook path should be exits and function should be a function';
	}

	METHOD_HOOKS[path + '__' + place] = {
		path, place, hook
	};
}

function generateFunc(body: string, path: string) {
	body += `\n//# sourceURL=${Settings.HTTP_STRING}jit/${path}.js`;

	try {
		return  new Function('context', body);
	} catch (e) {
		throw new Error('Compiler error:\n\n' + body);
	}
}

function findJumpTarget(
	instrs: Instruction[],
	jumps: number[],
	initial: number,
	target: number
): { startIndex: number, endIndex: number } {
	let startIndex = -1;
	let endIndex = -1;

	for (let i = initial; i < instrs.length; i++) {
		const inst = instrs[i];

		if (inst.position === target) {
			startIndex = i;
		}

		if (startIndex > i && jumps.indexOf(inst.position) >= 0) {
			endIndex = i;
			break;
		}
	}

	if (startIndex >= 0 && endIndex  === -1)
		endIndex = instrs.length;

	return  {
		startIndex, endIndex
	};
}

function isFastReturnVoid(
	instrs: Instruction[],
	jumps: number[],
	initial: number,
	target: number
): boolean {
	if (Settings.MAX_INLINE_RETURN <= 0) {
		return false;
	}

	const {
		startIndex
	} = findJumpTarget(instrs, jumps, initial, target);

	return startIndex >= 0 && instrs[startIndex].name === Bytecode.RETURNVOID;
}

//@ts-ignore
self.attach_hook = UNSAFE_attachMethodHook;

function resolveTrait(info: InstanceInfo, name: Multiname): TraitInfo | RuntimeTraitInfo {
	info.traits.resolve();

	let trait = info.traits.getTrait(name);
	let superInstance = info;

	while (Settings.CHEK_SUPER_TRAITS && !trait && superInstance && superInstance instanceof InstanceInfo) {
		const superName = superInstance.getSuperName();

		if (!superName) {
			return null;
		}

		const addDom = <AXApplicationDomain> (<any> superName.value).applicationDomain;
		const superClass = addDom.getClass(superName);

		superInstance = superClass.classInfo.instanceInfo;

		if (superInstance.runtimeTraits) {
			trait = <any> superInstance.runtimeTraits.getTrait(name.namespaces, name.name);

			if (trait) {
				return  trait;
			}
		}

		superInstance.traits.resolve();
		trait = superInstance.traits.getTrait(name);

		if (trait) {
			return  trait;
		}
	}

	return trait;
}

export interface ICompilerProcess {
	error?: {
		message: string, reason: COMPILATION_FAIL_REASON
	};
	source?: string;
	compiling?: Promise<Function> | undefined;
	compiled?: Function;
	names?: Multiname[];
}
export interface ICompilerOptions {
	scope?: Scope;
	optimise?: COMPILER_OPT_FLAGS;
	encrupted?: boolean
}

export function compile(methodInfo: MethodInfo, options: ICompilerOptions = {}): ICompilerProcess {
	const {
		optimise = COMPILER_DEFAULT_OPT,
		scope: executionScope,
	} = options;

	const state = new CompilerState(methodInfo);
	const staticHoistLex = new StaticHoistLex();

	// lex generator
	const lexGen = new ComplexGenerator([
		new PhysicsLex({ box2D: false }), // generate static aliases for Physics engine
		new TopLevelLex(), // generate alias for TopLevel props
		//staticHoistLex // collided with fastCall yet, need fix it
	]);

	const tinyCtr = new TinyConstructor();
	// todo
	// 	fastCall not supported now, we change compile flow and it generate wrong results
	// 	remove or refact it
	const fastCall = null;//new FastCall(lexGen, executionScope);

	Stat.begin('');

	const USE_OPT = (opt: any) => {
		return optimise & COMPILER_OPT_FLAGS.ALLOW_CUSTOM_OPTIMISER && !!opt;
	};

	if (USE_OPT(tinyCtr)) {
		const b = tinyCtr.getBody(methodInfo);
		if (typeof b === 'function') {
			Stat.drop();

			return {
				names: [],
				compiled: b
			};
		}
	}

	const meta = methodInfo.meta;
	const methodName = meta.name;
	const {
		error,
		jumps,
		catchStart,
		catchEnd,
		set : q
	} = analyze(methodInfo) as IAnalyseResult & IAnalyzeError;

	// if affilate a generate error, broadcast it
	if (error) {
		Stat.drop();

		// if a error is not debuggable, drop compilation
		if (error.reason !== COMPILATION_FAIL_REASON.UNDERRUN || !(optimise & COMPILER_OPT_FLAGS.DEBUG_UNDERRUN)) {
			return { error };
		}
	}

	const instanceInfo = <InstanceInfo> (methodInfo.instanceInfo || methodInfo.trait?.holder);
	const abc = methodInfo.abc;
	const body = methodInfo.getBody();
	const maxstack = body.maxStack;
	const maxlocal = body.localCount - 1;
	const maxscope = body.maxScopeDepth - body.initScopeDepth;

	const js0 = state.headerBlock;
	const js = state.mainBlock;

	let domMem = false;
	for (const q_i of q) {
		const b = q_i.name;
		domMem = domMem || (b >= Bytecode.LI8 && b <= Bytecode.SF64);
	}

	state.moveIndent(1);

	const params = methodInfo.parameters;
	const useESArguments = optimise & COMPILER_OPT_FLAGS.USE_ES_PARAMS;
	const  { paramsShift, annotation } = useESArguments
		? emitAnnotation(state)
		: emitAnnotationOld(state);

	// store indend after annotation
	const namesIndent = state.indent;

	js0.push(annotation);

	const LOCALS_POS = js0.length;
	// hack
	js0.push('__PLACE__FOR__OPTIONAL__LOCALS__');

	const optionalLocalVars: Array<{index: number, die: boolean, read: number, write: 0, isArgumentList: boolean}> = [];

	for (let i: number = params.length + 1 + paramsShift; i <= maxlocal; i++) {
		optionalLocalVars[i] = {
			index: i,
			isArgumentList: i === params.length + 1,
			read: 0,
			write: 0,
			die: false,
		};
	}

	for (let i = 0; i < maxstack; i++)
		js0.push(`${namesIndent}let stack${i} = undefined;`);

	for (let i: number = 0; i < maxscope; i++)
		js0.push(`${namesIndent}let scope${i} = undefined;`);

	js0.push(`${namesIndent}let temp = undefined;`);

	if (domMem)
		js0.push(`${namesIndent}let domainMemory; // domainMemory`);

	const names: Multiname[] = state.names;
	const getname = (n: number) => emitInlineMultiname(state, state.getMultinameIndex(n));

	js0.push(`${namesIndent}let sec = context.sec;`);

	const genBrancher = jumps.length > 1 || catchStart;

	if (METHOD_HOOKS && METHOD_HOOKS[meta.classPath + '__begin']) {
		state.emitMain('/* ATTACH METHOD HOOK */');
		state.emitMain(`context.executeHook(${emitInlineLocal(state, 0)}, '${meta.classPath + '__begin'}')`);
	}
	state.emitMain('');

	const catches = catchStart
		? Object.keys(catchStart).length
		: 0;

	const useLoopGuard =
	(
		Settings.ENABLE_LOOP_GUARD
		&& genBrancher
		// every cathch has 2 jumps, ignore it
		&& (jumps.length - catches * 2) >= Settings.LOOP_GUARD_MIN_BRANCHES
	);

	if (genBrancher) {
		if (useLoopGuard) {
			state.emitMain('let tick = 0;');
		}

		state.emitMain('let p = 0;');
		state.emitBeginMain('while (true) {'); // add { automatically

		if (useLoopGuard) {
			const loops = Settings.LOOP_GUARD_MAX_LOOPS;

			state.emitBeginMain(`if (tick++ > ${loops}) {`);
			state.emitMain(
				// eslint-disable-next-line max-len
				`throw 'To many loops (> ${loops}) in "${meta.classPath}" at' + p + ' ,method was dropped to avoid stucking';\n'`
			);
			state.emitEndMain();
		}

		state.emitBeginMain('switch (p) {');
	}

	let currentCatchBlocks: ExceptionInfo[];
	let lastZ: Instruction;
	let z: Instruction;

	// case + case int
	genBrancher && state.moveIndent(2);

	const stackF = (n: number, alias = true) => emitInlineStack(state, n, alias);
	const local = (n: number) => emitInlineLocal(state, n);
	const param = (n: number) => {
		const p = state.currentOpcode.params;
		return typeof p === 'number' ? p : p[n];
	};

	for (let i: number = 0; i < q.length; i++) {
		// store oppcode in state
		state.currentOpcode = q[i];

		z && (lastZ = z);
		z = q[i];

		USE_OPT(fastCall) && fastCall.killFar(i);

		if (jumps.indexOf(z.position) >= 0) {
			// drop aliases for stack, because branching, alias outside branch can be invalid
			state.dropAllAliases();
			// if we are in any try-catch-blocks, we must close them
			//if (state.openTryCatchGroups)
			state.openTryCatchGroups.forEach(e => emitCloseTryCatch(state, e));

			if (genBrancher) {
				state.moveIndent(-1);
				state.emitMain(`case ${z.position}:`);
				state.moveIndent(1);
			}

			// now we reopen all the try-catch again
			state.openTryCatchGroups.forEach(e => emitOpenTryCatch(state, e));
		}

		/* DIRTY */
		currentCatchBlocks = catchStart ? catchStart[z.position] : null;
		if (currentCatchBlocks) {
			state.openTryCatchGroups.push(currentCatchBlocks);

			state.emitBeginMain('try {');
			state.moveIndent(1);
		}

		if (Settings.PRINT_BYTE_INSTRUCTION) {
			state.emitMain(`//${BytecodeName[z.name]} ${ typeof z.params === 'number' ? z.params : z.params.join(' / ')} -> ${z.returnTypeId}`);
		}

		if (z.comment) {
			state.emitMain(`//${z.comment}`);
		}

		const stack0 = stackF(0);
		const stack1 = stackF(1);
		const stack2 = stackF(2);
		const stack3 = stackF(3);
		const scope = z.scope > 0 ? `scope${(z.scope - 1)}` : 'context.savedScope';
		const scopeN = 'scope' + z.scope;

		if (z.stack < 0) {
			state.emitMain('// unreachable');
		} else {
			let localIndex = 0;
			switch (z.name) {
				case Bytecode.LABEL:
					break;
				case Bytecode.DXNSLATE:
					state.emitMain(`${scope}.defaultNamespace = context.internNamespace(0, ${stack0});`);
					break;
				case Bytecode.DEBUGFILE:
					break;
				case Bytecode.DEBUGLINE:
					break;
				case Bytecode.DEBUG:
					break;
				case Bytecode.THROW:
					state.emitMain(`throw ${stack0};`);
					break;
				case Bytecode.GETLOCAL: {
					localIndex = param(0);
					optionalLocalVars[localIndex] && (optionalLocalVars[localIndex].read++);

					// going onto state, we have a lot of test that allow inlining
					state.emitGetLocal(-1, localIndex);
					break;
				}
				case Bytecode.SETLOCAL:
					localIndex = param(0);

					if (optionalLocalVars[localIndex]) {
						optionalLocalVars[localIndex].write++;

						if (!optionalLocalVars[localIndex].read) {
							optionalLocalVars[localIndex].die = true;
						}
					}

					state.killConstAliasInstruction([stackF(0, false)]);

					state.popAnyAlias(local(localIndex));
					state.emitMain(`${local(localIndex)} = ${stack0};`);
					// this is unpossible, because AVM not store `this` in local another that 0
					/*
					if (state.isThisAlias(stack0)) {
						state.pushThisAlias(local(localIndex));
					}
					*/
					break;

				case Bytecode.GETSLOT:
					state.popAnyAlias(stack0);
					// slots can be get/set only on AX objects
					state.emitMain(`${stackF(0, false)} = ${stack0}.axGetSlot(${param(0)});`);
					break;
				case Bytecode.SETSLOT:
					state.emitMain(`${stack1}.axSetSlot(${param(0)}, ${stack0});`);
					break;

				case Bytecode.GETGLOBALSCOPE:
					state.popAnyAlias(stackF(-1, false));
					state.emitMain(`${stackF(-1, false)} = context.savedScope.global.object;`);
					break;
				case Bytecode.PUSHSCOPE:
					staticHoistLex?.markScope(scopeN, js.length);
					// extends can be used only on AXObject
					state.emitMain(`${scopeN} = ${scope}.extend(${stack0});`);
					break;
				case Bytecode.PUSHWITH:
					state.emitMain(`${scopeN} = context.pushwith(${scope}, ${stack0});`);
					break;
				case Bytecode.POPSCOPE:
					state.emitMain(`${scope} = undefined;`);
					break;
				case Bytecode.GETSCOPEOBJECT:
					state.popAnyAlias(stackF(-1, false));
					state.emitMain(`${stackF(-1)} = scope${param(0)}.object;`);
					break;

				case Bytecode.NEXTNAME:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = sec.box(${stack1}).axNextName(${stack0});`);
					break;
				case Bytecode.NEXTVALUE:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = sec.box(${stack1}).axNextValue(${stack0});`);
					break;
				case Bytecode.HASNEXT:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = sec.box(${stack1}).axNextNameIndex(${stack0});`);
					break;
				case Bytecode.HASNEXT2:
					state.popAnyAlias(stackF(-1, false));
					state.emitMain(`temp = context.hasnext2(${local(param(0))}, ${local(param(1))});`);
					state.emitMain(`${local(param(0))} = temp[0];`);
					state.emitMain(`${local(param(1))} = temp[1];`);
					state.emitMain(`${stackF(-1)} = ${local(param(1))} > 0;`);
					break;
				case Bytecode.IN:
					state.popAnyAlias(stackF(1, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(1)} = (${stack1} && ${stack1}.axClass === sec.AXQName) ? obj.axHasProperty(${stack1}.name) : ${stack0}.axHasPublicProperty(${stack1});`);
					break;

				case Bytecode.DUP:
					state.popAnyAlias(stackF(-1, false));
					state.emitMain(`${stackF(-1)} = ${stack0};`);
					state.pushThisAlias(stackF(-1), stack0);
					break;
				case Bytecode.POP:
					// it real pop stack0 ?
					state.popAnyAlias(stackF(0, false));
					//js.push(`${idnt};`)
					break;
				case Bytecode.SWAP: {
					state.popAnyAlias(stackF(0, false));
					state.popAnyAlias(stackF(1, false));

					state.emitMain(`temp = ${stack0};`);
					state.emitMain(`${stackF(0)} = ${stack1};`);
					state.emitMain(`${stackF(1)} = temp;`);
					state.emitMain('temp = undefined;');
					break;
				}
				case Bytecode.PUSHTRUE:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1),true);
					break;
				case Bytecode.PUSHFALSE:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1),false);
					break;
				case Bytecode.PUSHBYTE:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), param(0));
					break;
				case Bytecode.PUSHSHORT:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), param(0));
					break;
				case Bytecode.PUSHINT:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), abc.ints[param(0)]);
					break;
				case Bytecode.PUSHUINT:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), abc.uints[param(0)]);
					break;
				case Bytecode.PUSHDOUBLE:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), abc.doubles[param(0)]);
					break;
				case Bytecode.PUSHSTRING:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), abc.getString(param(0)));
					break;
				case Bytecode.PUSHNAN:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), NaN);
					break;
				case Bytecode.PUSHNULL:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), null);
					break;
				case Bytecode.PUSHUNDEFINED:
					state.popAnyAlias(stackF(-1, false));
					state.emitConst(stackF(-1), undefined);
					break;
				case Bytecode.IFEQ: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} == ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} == ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFNE: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} != ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} != ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFSTRICTEQ: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} === ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} === ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFSTRICTNE: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} !== ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} !== ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFNLE: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (!(${stack0} >= ${stack1})) { return; }`);
						break;
					}

					state.emitMain(`if (!(${stack0} >= ${stack1})) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFGT: {
					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} < ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} < ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFNLT: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (!(${stack0} > ${stack1})) { return; }`);
						break;
					}

					state.emitMain(`if (!(${stack0} > ${stack1})) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFGE: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} <= ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} <= ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFNGE: {
					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (!(${stack0} <= ${stack1})) { return; }`);
						break;
					}

					state.emitMain(`if (!(${stack0} <= ${stack1})) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFLT: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} > ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} > ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFNGT: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (!(${stack0} < ${stack1})) { return; }`);
						break;
					}

					state.emitMain(`if (!(${stack0} < ${stack1})) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFLE: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0} >= ${stack1}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0} >= ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFFALSE: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (!${stack0}) { return; }`);
						break;
					}

					state.emitMain(`if (!${stack0}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.IFTRUE: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain(`if (${stack0}) { return; }`);
						break;
					}

					state.emitMain(`if (${stack0}) { p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.LOOKUPSWITCH: {
					const jj = (<[]>z.params).concat();
					const dj = jj.shift();
					// eslint-disable-next-line max-len
					state.emitMain(`if (${stack0} >= 0 && ${stack0} < ${jj.length}) { p = [${jj.join(', ')}][${stack0}]; continue; } else { p = ${dj}; continue; };`);
					break;
				}
				case Bytecode.JUMP: {

					if (isFastReturnVoid(q, jumps, i, param(0))) {
						state.emitMain('//JIT: Emit inline return');
						state.emitMain('return;');
						break;
					}

					state.emitMain(`{ p = ${param(0)}; continue; };`);
					break;
				}
				case Bytecode.INCREMENT:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)}++;`);
					break;
				case Bytecode.DECREMENT:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)}--;`);
					break;
				case Bytecode.INCLOCAL:
					state.emitMain(`${local(param(0))}++;`);
					break;
				case Bytecode.DECLOCAL:
					state.emitMain(`${local(param(0))}--;`);
					break;
				case Bytecode.INCREMENT_I:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = (${stackF(0)} | 0) + 1;`);
					break;
				case Bytecode.DECREMENT_I:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = (${stackF(0)} | 0) - 1;`);
					break;
				case Bytecode.INCLOCAL_I:
					state.emitMain(`${local(param(0))} = (${local(param(0))} | 0) + 1;`);
					break;
				case Bytecode.DECLOCAL_I:
					state.emitMain(`${local(param(0))} = (${local(param(0))} | 0) - 1;`);
					break;
				case Bytecode.NEGATE_I:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = -(${stack0} | 0);`);
					break;
				case Bytecode.ADD_I:
					state.killConstAliasInstruction([stackF(0, false)]);
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = (${stack1} | 0) + (${stack0} | 0);`);
					break;
				case Bytecode.SUBTRACT_I:
					state.killConstAliasInstruction([stackF(0, false)]);
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = (${stack1} | 0) - (${stack0} | 0);`);
					break;
				case Bytecode.MULTIPLY_I:
					state.killConstAliasInstruction([stackF(0, false)]);
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = (${stack1} | 0) * (${stack0} | 0);`);
					break;
				case Bytecode.ADD:
					state.killConstAliasInstruction([stackF(0, false)]);
					// LOL, this can be used when this used in string concation
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} += ${stack0};`);
					break;
				case Bytecode.SUBTRACT:
					state.killConstAliasInstruction([stackF(0, false)]);
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} -= ${stack0};`);
					break;
				case Bytecode.MULTIPLY:
					state.killConstAliasInstruction([stackF(0, false)]);
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} *= ${stack0};`);
					break;
				case Bytecode.DIVIDE:
					state.killConstAliasInstruction([stackF(0, false)]);
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} /= ${stack0};`);
					break;
				case Bytecode.MODULO:
					state.killConstAliasInstruction([stackF(0, false)]);
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} %= ${stack0};`);
					break;

				case Bytecode.LSHIFT:
					state.popAnyAlias(stackF(1, false));

					state.emitMain(`${stackF(1)} <<= ${stack0};`);
					break;
				case Bytecode.RSHIFT:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} >>= ${stack0};`);
					break;
				case Bytecode.URSHIFT:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} >>>= ${stack0};`);
					break;

				case Bytecode.BITAND:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} &= ${stack0};`);
					break;
				case Bytecode.BITOR:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} |= ${stack0};`);
					break;
				case Bytecode.BITXOR:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} ^= ${stack0};`);
					break;

				case Bytecode.EQUALS:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack1} == ${stack0};`);
					break;
				case Bytecode.STRICTEQUALS:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack1} === ${stack0};`);
					break;
				case Bytecode.GREATERTHAN:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack1} > ${stack0};`);
					break;
				case Bytecode.GREATEREQUALS:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack1} >= ${stack0};`);
					break;
				case Bytecode.LESSTHAN:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack1} < ${stack0};`);
					break;
				case Bytecode.LESSEQUALS:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack1} <= ${stack0};`);
					break;
				case Bytecode.NOT:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = !${stack0};`);
					break;
				case Bytecode.BITNOT:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = ~${stack0};`);
					break;
				case Bytecode.NEGATE:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = -${stack0};`);
					break;
				case Bytecode.TYPEOF:
					state.popAnyAlias(stackF(0, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(0)} = typeof ${stack0} === 'undefined' ? 'undefined' : context.typeof(${stack0});`);
					break;
				case Bytecode.INSTANCEOF:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack0}.axIsInstanceOf(${stack1});`);
					break;
				case Bytecode.ISTYPE:
					state.popAnyAlias(stackF(0, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(0)} = ${scope}.getScopeProperty(${getname(param(0))}, true, false).axIsType(${stack0});`);
					break;
				case Bytecode.ISTYPELATE:
					state.popAnyAlias(stackF(1, false));
					state.emitMain(`${stackF(1)} = ${stack0}.axIsType(${stack1});`);
					break;
				case Bytecode.ASTYPE:
					if ((optimise & COMPILER_OPT_FLAGS.SKIP_NULL_COERCE)
						&& (lastZ.name === Bytecode.PUSHNULL
							|| lastZ.name === Bytecode.PUSHUNDEFINED)) {
						state.emitMain('// SKIP_NULL_COERCE');
						break;
					}
					state.popAnyAlias(stackF(0, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(0)} = ${scope}.getScopeProperty(${getname(param(0))}, true, false).axAsType(${stack0});`);
					break;

				case Bytecode.ASTYPELATE:
					state.popAnyAlias(stackF(1, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(1)} = ${emitIsAXOrPrimitive(stack1)} ? ${stack0}.axAsType(${stack1}) : ${stack1};`);
					break;

				case Bytecode.CALL: {
					state.popAnyAlias(stackF(param(0) + 1, false));

					const pp = [];
					const obj = stackF(param(0) + 1);
					for (let j: number = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					// eslint-disable-next-line max-len
					state.emitMain(`${obj} = context.call(${stackF(param(0) + 1)}, ${stackF(param(0))}, [${pp.join(', ')}], ${scope});`);
					break;
				}
				case Bytecode.CONSTRUCT: {
					state.popAnyAlias(stackF(param(0), false));

					const pp = [];
					const obj = stackF(param(0));

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					// eslint-disable-next-line max-len
					state.emitMain(`${obj} = context.construct(${obj}, [${pp.join(', ')}]);`);
					break;
				}
				case Bytecode.CALLPROPERTY: {
					const mn = abc.getMultiname(param(1));
					const pp = [];
					const obj = stackF(param(0));

					for (let j: number = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					state.killConstAliasInstruction([stackF(param(0), false)]);
					state.popAnyAlias(stackF(param(0), false));

					const targetStack = stackF(param(0));

					if (abc.getMultiname(param(1)).name == 'getDefinitionByName') {
						// eslint-disable-next-line max-len
						state.emitMain(`${targetStack} = context.getdefinitionbyname(${scope}, ${obj}, [${pp.join(', ')}]);`);
					} else {
						let d: ICallEntry;
						if (USE_OPT(fastCall) && (d = fastCall.sureThatFast(`${obj}`, mn.getMangledName()))) {
							const n = d.isMangled ? Multiname.getPublicMangledName(mn.name) : mn.name;
							fastCall.kill(`${obj}`);

							state.emitMain('/* We sure that this safe call */');
							if (d.isFunc) {
								state.emitMain(`${targetStack} = ${emitAccess(obj, n)}(${pp.join(', ')});`);
							} else {
								// eslint-disable-next-line max-len
								state.emitMain(`${targetStack} = /*fast*/sec.box(${obj}).axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
							}
							break;
						}

						// we can check trite for `this` or any types that has trite
						// @todo move this to fast-call
						if (Settings.CHEK_TRAIT_GET_CALL && obj === 'this' && instanceInfo) {
							const trait = resolveTrait(instanceInfo, mn);

							if (trait) {
								// eslint-disable-next-line max-len
								state.emitMain(`/* We sure that this safe call, represented in TRAIT as ${TRAITNames[trait.kind]}  */ `);

								if (trait.kind === TRAIT.Method) {
									// eslint-disable-next-line max-len
									state.emitMain(`${targetStack} = ${emitAccess(obj, mn.getMangledName())}(${pp.join(', ')});`);
								} else {
									// when is method, we should wrap caller, because JS miss `this`
									// when method is used as outside object
									// we can do with BIND, but this is can be unstable
									// eslint-disable-next-line max-len
									state.emitMain(`${targetStack} = /*fast*/${obj}.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
								}
								break;
							}
						}

						const fast = needFastCheck() && (obj !== 'this' || !Settings.NO_CHECK_FASTCALL_FOR_THIS);
						if (fast) {
							state.emitMain(`if (!${emitIsAXOrPrimitive(obj)}) {`);
							// fast instruction already binded
							state.emitMain(`   ${targetStack} = ${emitAccess(obj, mn.name)}(${pp.join(', ')});`);
							state.emitBeginMain('} else {');
						}

						state.emitMain(`// ${mn}`);
						state.emitBeginMain(); // {

						const box = !Settings.NO_CHECK_BOXED_THIS || obj !== 'this';
						if (box) {
							state.emitMain(`let t = ${obj};`);
							const accessor = emitAccess('t', '$Bg' + mn.name);
							// eslint-disable-next-line max-len
							state.emitMain(`const m = ${accessor} || (t = sec.box(${obj}), ${accessor});`);
						} else {
							state.emitMain(`const m = ${emitAccess(obj, '$Bg' + mn.name)};`);
						}

						state.emitMain('if( typeof m === "function" ) { ');
						// eslint-disable-next-line max-len
						state.emitMain(`    ${targetStack} = ${emitAccess(box ? 't' : obj, '$Bg' + mn.name)} (${pp.join(', ')});`);
						state.emitMain('} else { ');
						// eslint-disable-next-line max-len
						state.emitMain(`    ${targetStack} = ${obj}.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
						state.emitMain('}');

						state.emitEndMain(); // }

						if (fast) {
							state.emitEndMain(); // }
						}

					}
					break;
				}
				case Bytecode.CALLPROPLEX: {
					const mn = abc.getMultiname(param(1));

					state.popAnyAlias(stackF(param(0), false));

					const targetStack = stackF(param(0));
					const pp = [];

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					state.emitMain(`temp = sec.box(${targetStack});`);

					const accessor = emitAccess('temp', '$Bg' + mn.name);

					// eslint-disable-next-line max-len
					state.emitMain(`${targetStack} = (typeof ${accessor} === 'function')? ${accessor}(${pp.join(', ')}) : temp.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], true);`);
				}
					break;
				case Bytecode.CALLPROPVOID: {
					const mn = abc.getMultiname(param(1));
					const pp = [];
					const obj = stackF(param(0));

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					state.killConstAliasInstruction([stackF(param(0), false)]);

					{
						if (USE_OPT(fastCall) && fastCall.sureThatFast(obj)) {
							const n = fastCall.sureThatFast(obj).isMangled
								? Multiname.getPublicMangledName(mn.name)
								: mn.name;

							state.emitMain('/* We sure that this safe call */ ');
							state.emitMain(`${emitAccess(obj, n)}(${pp.join(', ')});`);

							fastCall.kill(`${obj}`);
							break;
						}
					}

					// we can check trite for `this` or any types that has trite
					// @todo move this to fast-call
					if (Settings.CHEK_TRAIT_GET_CALL && obj === 'this' && instanceInfo) {
						const trait = resolveTrait(instanceInfo, mn);

						if (trait) {
							// eslint-disable-next-line max-len
							state.emitMain(`/* We sure that this safe call, represented in TRAIT as ${TRAITNames[trait.kind]}  */ `);

							if (trait.kind === TRAIT.Method) {
								// eslint-disable-next-line max-len
								state.emitMain(`${emitAccess(obj, mn.getMangledName())}(${pp.join(', ')});`);
							} else {
								// when is method, we should wrap caller, because JS miss `this`
								// when method is used as outside object
								// we can do with BIND, but this is can be unstable
								// eslint-disable-next-line max-len
								state.emitMain(`/*fast*/${obj}.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
							}
							break;
						}
					}

					const fast = needFastCheck() && (obj !== 'this' || !Settings.NO_CHECK_FASTCALL_FOR_THIS);
					if (fast) {
						state.emitMain(`if (!${emitIsAXOrPrimitive(obj)}) {`);
						state.emitMain(`    ${emitAccess(obj, mn.name)}(${pp.join(', ')});`);
						state.emitMain('} else {');
						state.moveIndent(1);
					}

					state.emitMain(`// ${mn}`);
					state.emitBeginMain(); // {
					state.emitMain(`let t = ${obj};`);

					const accessor = emitAccess('t', '$Bg' + mn.name);

					state.emitMain(`const m = ${accessor} || (t = sec.box(${obj}), ${accessor});`);
					state.emitMain('if( typeof m === "function" ) { ');
					state.emitMain(`    m.call(t${pp.length ? ', ' : ''}${pp.join(', ')});`);
					state.emitMain('} else { ');
					state.emitMain(`   ${obj}.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
					state.emitMain('}');
					state.emitEndMain(); // }

					if (fast) {
						state.emitEndMain(); // }
					}

				}
					break;
				case Bytecode.APPLYTYPE: {
					const pp = [];

					state.popAnyAlias(stackF(param(0), false));

					const targetStack = stackF(param(0));

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					state.emitMain(`${targetStack} = sec.applyType(${targetStack}, [${pp.join(', ')}]);`);
					break;
				}
				case Bytecode.FINDPROPSTRICT: {
					const mn = abc.getMultiname(param(0));
					state.emitMain(`// ${mn}`);
					state.popAnyAlias(stackF(-1, false));

					const target = stackF(-1);
					if (USE_OPT(lexGen) && lexGen.test(mn, false)) {
						state.emitMain('/* GenerateLexImports */');
						// eslint-disable-next-line max-len
						const lexAlias = lexGen.getPropStrictAlias(mn,{
							//nameAlias: getname(param(0)),
							mnIndex: state.getMultinameIndex(param(0))
							/*findProp: true,*/
						});
						//state.emitMain(`${target} = ${lexAlias};`);
						// alias as const, this allow inline it
						state.emitConst(target, lexAlias, false);

						if (USE_OPT(fastCall)) {
							const mangled = (lexGen.getGenerator(mn, false) instanceof TopLevelLex);
							fastCall.mark(target, i, mangled, mn);
						}
						break;
					}

					// generate fast lookup for get/call
					// scope === 1 is extended scope
					if (Settings.CHEK_TRAIT_GET_CALL
						&& Settings.CHEK_TRAIT_FIND_PROP
						&& z.scope === 1
						&& instanceInfo
					) {
						const trait = resolveTrait(instanceInfo, mn);

						if (trait) {
							// eslint-disable-next-line max-len
							state.emitMain(`/* We sure that this scope owner, represented in TRAIT as ${TRAITNames[trait.kind]}  */ `);
							state.emitGetLocal(-1, 0);
							break;
						}

					}

					state.emitMain(`${stackF(-1)} = ${scope}.findScopeProperty(${getname(param(0))}, true, false);`);
					break;
				}

				case Bytecode.FINDPROPERTY:
					state.emitMain(`// ${abc.getMultiname(param(0))}`);
					state.popAnyAlias(stackF(-1, false));
					state.emitMain(`${stackF(-1)} = ${scope}.findScopeProperty(${getname(param(0))}, false, false);`);
					break;
				case Bytecode.NEWFUNCTION:
					state.emitMain(`// ${abc.getMethodInfo(param(0))}`);
					state.popAnyAlias(stackF(-1, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(-1)} = context.createFunction(${param(0)}, ${scope}, true, ${methodInfo.index()});`);
					break;
				case Bytecode.NEWCLASS:
					state.emitMain(`// ${abc.classes[param(0)]}`);
					state.popAnyAlias(stackF(0, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(0)} = sec.createClass(context.abc.classes[${param(0)}], ${stack0}, ${scope});`);
					break;

				case Bytecode.GETDESCENDANTS:
				{
					const mn = abc.getMultiname(param(0));
					state.emitMain(`// ${mn}`);

					if (mn.isRuntimeName()) {
						const runtime = mn.isRuntimeName() && mn.isRuntimeNamespace();

						state.popAnyAlias(runtime ? stackF(2, false) : stackF(1, false));

						const target = runtime ? stackF(2) : stackF(1);

						state.emitBeginMain(); //{

						if (runtime) {
							// eslint-disable-next-line max-len
							state.emitMain(`const rn = context.runtimename(${getname(param(0))}, ${stack0}, ${stack1});`);
						} else {
							state.emitMain(`const rn = context.runtimename(${getname(param(0))}, ${stack0});`);
						}

						state.emitMain(`${target} = ${target}.descendants(rn);`);
						state.emitEndMain(); // }

						break;

					} else {
						state.popAnyAlias(stackF(0, false));
						state.emitMain(`${stackF(0)} = ${stack0}.descendants(${getname(param(0))});`);
					}
					break;
				}
				case Bytecode.NEWARRAY: {
					const pp = [];

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					state.popAnyAlias(stackF(param(0) - 1, false));
					state.emitMain(`${stackF(param(0) - 1)} = sec.AXArray.axBox([${pp.join(', ')}]);`);
					break;
				}
				case Bytecode.NEWOBJECT: {
					state.emitMain('temp = Object.create(sec.AXObject.tPrototype);');

					for (let j: number = 1; j <= param(0); j++) {
						// eslint-disable-next-line max-len
						state.emitMain(`temp.axSetPublicProperty(${stackF(2 * param(0) - 2 * j + 1)}, ${stackF(2 * param(0) - 2 * j)});`);
					}

					state.popAnyAlias(stackF(2 * param(0) - 1, false));
					state.emitMain(`${stackF(2 * param(0) - 1)} = temp;`);
					state.emitMain('temp = undefined;');
					break;
				}
				case Bytecode.NEWACTIVATION:
					state.popAnyAlias(stackF(-1, false));
					state.emitMain(`${stackF(-1)} = sec.createActivation(context.mi, ${scope});`);
					break;
				case Bytecode.NEWCATCH:
					state.popAnyAlias(stackF(-1, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(-1)} = sec.createCatch(context.mi.getBody().catchBlocks[${param(0)}], ${scope});`);
					break;
				case Bytecode.CONSTRUCTSUPER: {
					const pp = [];

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					state.emitMain(`context.savedScope.superConstructor.call(${stackF(param(0))}, ${pp.join(', ')});`);
				}
					break;
				case Bytecode.CALLSUPER: {
					const pp = [];
					state.popAnyAlias(stackF(param(0), false));
					const targetStack = stackF(param(0));

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					// eslint-disable-next-line max-len
					state.emitMain(`${targetStack} = sec.box(${targetStack}).axCallSuper(${getname(param(1))}, context.savedScope, [${pp.join(', ')}]);`);
					break;
				}
				case Bytecode.CALLSUPER_DYN: {
					const pp = [];

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					const mn = abc.getMultiname(param(1));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						state.popAnyAlias(stackF(param(0) + 2, false));
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(param(0) + 2)} = sec.box(${stackF(param(0) + 2)}).axGetSuper(context.runtimename(${getname(param(1))}, ${stackF(param(0))}, ${stackF(param(0) + 1)}), context.savedScope, [${pp.join(', ')}]);`);
					} else {
						state.popAnyAlias(stackF(param(0) + 1, false));
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(param(0) + 1)} = sec.box(${stackF(param(0) + 1)}).axGetSuper(context.runtimename(${getname(param(1))}, ${stackF(param(0))}), context.savedScope, [${pp.join(', ')}]);`);
					}

					break;
				}
				case Bytecode.CALLSUPERVOID: {
					const pp = [];

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					// eslint-disable-next-line max-len
					state.emitMain(`sec.box(${stackF(param(0))}).axCallSuper(${getname(param(1))}, context.savedScope, [${pp.join(', ')}]);`);
				}
					break;
				case Bytecode.CONSTRUCTPROP: {
					const pp = [];
					const targetStack = stackF(param(0), false);
					const of = stackF(param(0));

					// order is important, we should check constant assigment to stack/local
					// before pop alias for this stack/local,
					// otherwise we lost a offset and can't remove redundant instruction
					state.killConstAliasInstruction([targetStack]);
					state.popAnyAlias(targetStack);

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
						state.killConstAliasInstruction([stackF(param(0) - j, false)]);
					}

					let supportFast = false;
					const trace = [];

					if (Settings.CHECK_FAST_CONSTRUCTOR) {
						supportFast = isFastConstructSupport(abc.getMultiname(param(1)), trace);
					}

					if (supportFast) {
						state.emitMain('//JIT: Support fast construct:' + trace.join('/'));
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(param(0))} = context.constructFast(${of}, [${pp.join(', ')}], ${getname(param(1))});`);
					} else {
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(param(0))} = context.constructprop(${getname(param(1))}, ${of}, [${pp.join(', ')}]);`);
					}

					USE_OPT(fastCall) && fastCall.kill(stackF(param(0)));
				}
					break;
				case Bytecode.GETPROPERTY: {
					const mn = abc.getMultiname(param(0));
					const of = stackF(0);
					const target = stackF(0, false);

					state.killConstAliasInstruction([target]);
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`// ${mn}`);

					{
						let d: ICallEntry;
						if (USE_OPT(fastCall) && (d = fastCall.sureThatFast(of, mn.name))) {
							const n = d.isMangled ? Multiname.getPublicMangledName(mn.name) : mn.name;
							fastCall.kill(of);

							state.emitMain('/* We sure that this safe get */ ');
							state.emitMain(`${target} = ${emitAccess(of, n)};`);
							break;
						}
					}

					// we can check trite for `this` or any types that has trite
					// @todo Move this inside fast-call optimiser
					if (Settings.CHEK_TRAIT_GET_CALL && stack0 === 'this' && instanceInfo) {
						const trait = resolveTrait(instanceInfo, mn);
						if (trait) {
							// eslint-disable-next-line max-len
							state.emitMain(`/* We sure that this safe get, represented in TRAIT as ${TRAITNames[trait.kind]}  */ `);
							if (trait.kind === TRAIT.Method) {
								state.emitMain(`${target} = this.axGetProperty(${getname(param(0))});`);
								break;
							} else if (
								trait.kind === TRAIT.Slot ||
								trait.kind === TRAIT.GetterSetter ||
								trait.kind === TRAIT.Getter
							) {
								state.emitMain(`${target} = ${emitAccess(stack0, mn.getMangledName())};`);
								break;
							}
						}
					}

					const fast = needFastCheck() && (stack0 !== 'this' || !Settings.NO_CHECK_FASTCALL_FOR_THIS);
					if (fast) {
						state.emitMain(`if (!${emitIsAX(stack0)}) {`);
						state.emitMain(`    ${target} = ${stack0}['${mn.name}'];`);
						state.emitBeginMain('} else {');
					}

					const box = !Settings.NO_CHECK_BOXED_THIS || stack0 !== 'this';
					if (box) {
						state.emitMain(`temp = ${stack0}[AX_CLASS_SYMBOL] ? ${stack0} : sec.box(${stack0});`);
					}

					state.emitMain(`${target} = ${emitAccess(box ?  'temp' : stack0, '$Bg' + mn.name)};`);
					state.emitMain(`if (${target} === undefined || typeof ${target} === 'function') {`);
					state.emitMain(`    ${target} = ${box ?  'temp' : stack0}.axGetProperty(${getname(param(0))});`);
					state.emitMain('}');

					if (fast) {
						state.emitEndMain();
					}
					break;
				}
				case Bytecode.GETPROPERTY_DYN: {
					const mn = abc.getMultiname(param(0));
					const runtime = mn.isRuntimeName() && mn.isRuntimeNamespace();

					state.popAnyAlias(runtime ? stackF(2, false) : stackF(1, false));

					const target = runtime ? stackF(2) : stackF(1);

					state.emitMain(`// ${mn}`);
					state.emitBeginMain(); // {

					if (runtime) {
						state.emitMain(`const rm = context.runtimename(${getname(param(0))}, ${stack0}, ${stack1});`);
						state.emitMain('const simple = rm.numeric ? rm.numericValue : rm.name;');
					} else {
						state.emitMain(`let simple = ${stack0};`);
					}

					const box = !Settings.NO_CHECK_BOXED_THIS || target !== 'this';

					if (box) {
						state.emitMain(`const b_obj = ${target}[AX_CLASS_SYMBOL] ? ${target} : sec.box(${target});\n`);
					} else {
						state.emitMain(`const b_obj = ${target}`);
					}

					state.emitMain('if (typeof simple === "number") {');
					state.emitMain(`    ${target} = b_obj.axGetNumericProperty(simple);`);

					state.emitBeginMain('} else {');

					state.emitMain(`${target} = b_obj['$Bg' + simple];`);
					state.emitMain(`if (${target} === undefined || typeof ${target} === 'function') {`);

					if (!runtime) {
						state.emitMain(`    const rm = context.runtimename(${getname(param(0))}, ${stack0});`);
					}

					state.emitMain(`    ${target} = b_obj.axGetProperty(rm);`);
					state.emitMain('}');

					state.emitEndMain(); // }
					state.emitEndMain(); // }
					break;
				}
				case Bytecode.SETPROPERTY: {
					const mn = abc.getMultiname(param(0));
					state.killConstAliasInstruction([stackF(0, false), stackF(1, false)]);

					state.emitMain(`// ${mn}`);

					// we can check trite for `this` or any types that has trite
					// @todo Move this to fast-set optimisator
					if (Settings.CHEK_TRAIT_SET && stack1 === 'this' && instanceInfo) {
						const trait = resolveTrait(instanceInfo, mn);

						if (trait && trait) {
							// eslint-disable-next-line max-len
							state.emitMain(`/* We sure that this safe set, represented in TRAIT as ${TRAITNames[trait.kind]}, with type: ${(<SlotTraitInfo> trait).typeName}  */ `);

							if (
								trait.kind === TRAIT.Slot ||
								trait.kind === TRAIT.GetterSetter ||
								trait.kind === TRAIT.Getter ||
								trait.kind === TRAIT.Setter
							) {
								//debugger;
								// eslint-disable-next-line max-len
								state.emitMain(`${emitAccess(stack1, mn.getMangledName())} = ${emitPrimitiveCoerce(state, 0, (<any> trait).typeName, true)};`);
								break;
							}
						}
					}

					const fast = needFastCheck() && (stack1 !== 'this' || !Settings.NO_CHECK_FASTCALL_FOR_THIS);
					if (fast) {
						state.emitMain(`if (!${emitIsAX(stack1)}){`);
						state.emitMain(`    ${emitAccess(stack1, mn.name)} = ${stack0};`);
						state.emitBeginMain('} else {');
					}

					state.emitMain(`context.setproperty(${getname(param(0))}, ${stack0}, ${stack1});`);

					if (fast) {
						state.emitEndMain();
					}
					break;
				}
				case Bytecode.SETPROPERTY_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						// eslint-disable-next-line max-len
						state.emitMain(`context.setproperty(context.runtimename(${getname(param(0))}, ${stack1}, ${stack2}), ${stack0}, ${stack3});`);
					} else {
						// eslint-disable-next-line max-len
						state.emitMain(`context.setproperty(context.runtimename(${getname(param(0))}, ${stack1}), ${stack0}, ${stack2});`);
					}
					break;
				}
				case Bytecode.DELETEPROPERTY:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`// ${abc.getMultiname(param(0))}`);
					state.emitMain(`${stackF(0)} = context.deleteproperty(${getname(param(0))}, ${stack0});`);
					break;
				case Bytecode.DELETEPROPERTY_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						state.popAnyAlias(stackF(2, false));
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(2)} = context.deleteproperty(context.runtimename(${getname(param(0))}, ${stack0}, ${stack1}), ${stack2});`);
					} else {
						state.popAnyAlias(stackF(1, false));
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(1)} = context.deleteproperty(context.runtimename(${getname(param(0))}, ${stack0}), ${stack1});`);
					}
					break;
				}
				case Bytecode.GETSUPER:
					state.popAnyAlias(stackF(0, false));
					// eslint-disable-next-line max-len
					state.emitMain(`${stackF(0)} = sec.box(${stack0}).axGetSuper(${getname(param(0))}, context.savedScope);`);
					break;
				case Bytecode.GETSUPER_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						state.popAnyAlias(stackF(2, false));
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(2)} = sec.box(${stack2}).axGetSuper(context.runtimename(${getname(param(0))}, ${stack0}, ${stack1}), context.savedScope);`);

					} else {
						state.popAnyAlias(stackF(1, false));
						// eslint-disable-next-line max-len
						state.emitMain(`${stackF(1)} = sec.box(${stack1}).axGetSuper(context.runtimename(${getname(param(0))}, ${stack0}), context.savedScope);`);
					}
					break;
				}
				case Bytecode.SETSUPER:
					// eslint-disable-next-line max-len
					state.emitMain(`sec.box(${stack1}).axSetSuper(${getname(param(0))}, context.savedScope, ${stack0});`);
					break;
				case Bytecode.SETSUPER_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						// eslint-disable-next-line max-len
						state.emitMain(`sec.box(${stack3}).axSetSuper(context.runtimename(${getname(param(0))}, ${stack1}, ${stack2}), context.savedScope, ${stack0});`);
					} else {
						// eslint-disable-next-line max-len
						state.emitMain(`sec.box(${stack2}).axSetSuper(context.runtimename(${getname(param(0))}, ${stack1}), context.savedScope, ${stack0});`);
					}
					break;
				}
				case Bytecode.GETLEX: {
					const mn = abc.getMultiname(param(0));

					state.popAnyAlias(stackF(-1, false));
					const target = stackF(-1);

					if (USE_OPT(lexGen) && lexGen.test(mn, true)) {
						state.emitMain(`// ${mn}`);
						state.emitMain('/* GenerateLexImports GETLEX */');
						// eslint-disable-next-line max-len
						state.emitConst(
							target,
							lexGen.getLexAlias(mn,{
								mnIndex: state.getMultinameIndex(param(0)),
								/*findProp: false,*/
								scope: scope
							}), false);

						if (fastCall) {
							const mangled = (lexGen.getGenerator(mn, true) instanceof TopLevelLex);
							fastCall.mark(target, i, mangled, mn, true);
						}
						break;
					}

					// generate fast lookup for get/call
					// scope === 1 is extended scope
					if (Settings.CHEK_TRAIT_GET_CALL
						&& Settings.CHEK_TRAIT_FIND_PROP
						&& z.scope === 1
						&& instanceInfo
					) {
						const trait = resolveTrait(instanceInfo, mn);
						if (trait) {
							// eslint-disable-next-line max-len
							state.emitMain(`/* GETLEX We sure that this safe get, represented in TRAIT as ${TRAITNames[trait.kind]}  */ `);
							if (trait.kind === TRAIT.Method) {
								state.emitMain(`${target} = ${emitInlineLocal(state, 0)}.axGetProperty(${getname(param(0))});`);
								break;
							} else if (
								trait.kind === TRAIT.Slot ||
								trait.kind === TRAIT.GetterSetter ||
								trait.kind === TRAIT.Getter
							) {
								state.emitMain(
									`${target} = ${emitAccess(emitInlineLocal(state, 0), mn.getMangledName())};`
								);
								break;
							}
						}
					}

					state.emitMain(`// ${mn}`);
					state.emitMain(`temp = ${scope}.findScopeProperty(${getname(param(0))}, true, false);`);
					state.emitMain(`${target} = ${emitAccess('temp', '$Bg' + mn.name)};`);
					state.emitMain(`if (${target} === undefined || typeof ${target} === 'function') {`);
					state.emitMain(`    ${target} = temp.axGetProperty(${getname(param(0))});`);
					state.emitMain('}');

					break;
				}
				case Bytecode.RETURNVALUE: {
					if (METHOD_HOOKS && METHOD_HOOKS[meta.classPath + '__return']) {
						state.emitMain('/* ATTACH METHOD HOOK */');
						// eslint-disable-next-line max-len
						state.emitMain(`context.executeHook(${emitInlineLocal(state, 0)}, '${meta.classPath + '__return'}')`);
					}

					const typeName = methodInfo.getTypeName();

					if (!typeName ||
						Settings.COERCE_RETURN_MODE === COERCE_RETURN_MODE_ENUM.NONE
					) {
						state.emitMain(`return ${stack0};`);
						break;
					}

					if (isPrimitiveType(typeName)) {
						state.emitMain(`return ${emitPrimitiveCoerce(state, 0, typeName, true)};`);
						break;
					}

					if (Settings.COERCE_RETURN_MODE === COERCE_RETURN_MODE_ENUM.ALL) {
						state.emitMain(`return context.coerceReturn(${stack0});`);
						break;
					}

					state.emitMain(`return ${stack0};`);

					break;
				}

				case Bytecode.RETURNVOID:
					if (METHOD_HOOKS && METHOD_HOOKS[meta.classPath + '__return']) {
						state.emitMain('/* ATTACH METHOD HOOK */');
						// eslint-disable-next-line max-len
						state.emitMain(`context.executeHook(${emitInlineLocal(state, 0)}, '${meta.classPath + '__return'}')`);
					}

					state.emitMain('return;');
					break;
				case Bytecode.COERCE: {
					if ((optimise & COMPILER_OPT_FLAGS.SKIP_NULL_COERCE)
						&& (lastZ.name === Bytecode.PUSHNULL
							|| lastZ.name === Bytecode.PUSHUNDEFINED)) {
						state.emitMain('//JIT: SKIP_NULL_COERCE');
						break;
					}

					if (lastZ.name === Bytecode.ASTYPELATE) {
						state.emitMain('//JIT: SKIP DOUBLED COERCE AFTER ASTYPELATE');
						break;
					}

					state.popAnyAlias(stackF(0, false));

					// WE MUST EMIT REAL STACK WHEN ASSIGN TO IT,
					const target = stackF(0);
					const mn = abc.getMultiname(param(0));

					// skip coerce for native JS objects
					state.emitBeginMain(`if (${emitIsAX(target)}) {`);

					if (Settings.COERCE_MODE == COERCE_MODE_ENUM.DEFAULT) {
						// eslint-disable-next-line max-len
						state.emitMain(`${target} = ${scope}.getScopeProperty(${getname(param(0))}, true, false).axCoerce(${stack0});`);

					} else {
						// eslint-disable-next-line max-len
						state.emitMain(`var _e = ${scope}.getScopeProperty(${getname(param(0))}, true, false);`);

						if (Settings.COERCE_MODE === COERCE_MODE_ENUM.SOFT) {
							// eslint-disable-next-line max-len
							state.emitMain(`_e || console.warn('[${methodName}] Coerce Type not found:', ${JSON.stringify(mn.name)})`);
						}

						state.emitMain(`${target} = _e ? _e.axCoerce(${stack0}) : ${stack0};`);
					}
					state.emitEndMain();
					break;
				}
				case Bytecode.COERCE_A:
					state.emitMain('');
					break;
				case Bytecode.COERCE_S:
					if ((optimise & COMPILER_OPT_FLAGS.SKIP_NULL_COERCE)
						&& (lastZ.name === Bytecode.PUSHNULL
							|| lastZ.name === Bytecode.PUSHUNDEFINED)) {

						state.emitMain('// SKIP_NULL_COERCE');
						break;
					}

					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = context.axCoerceString(${stack0});`);
					break;

				case Bytecode.ESC_XELEM:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = context.escXElem(${stack0});`);

					break;
				case Bytecode.ESC_XATTR:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = context.escXAttr(${stack0});`);
					break;

				case Bytecode.CONVERT_I:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} |= 0;`);
					break;
				case Bytecode.CONVERT_D:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = +${stack0};`);
					break;
				case Bytecode.CONVERT_B:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} = !!${stack0};`);
					break;
				case Bytecode.CONVERT_U:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stackF(0)} >>>= 0;`);
					break;
				case Bytecode.CONVERT_S:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`if (typeof ${stack0} !== 'string') ${stackF(0)} = ${stack0} + '';`);
					break;
				case Bytecode.CONVERT_O:
					state.emitMain('');
					break;
				case Bytecode.CHECKFILTER:
					state.popAnyAlias(stackF(0, false));
					state.emitMain(`${stack0} = context.axCheckFilter(sec, ${stack0});`);
					break;
				case Bytecode.KILL:
					// Really we not requre KILL locals
					// anyway we not validating a locals after jumps, but this can corrupt obfuscated code
					// and for us this prevent inlining
					state.emitMain('// Redundant oppcode KILL, prevent optimisations');
					//state.popAnyAlias(local(param(0)));
					//state.emitMain(`${local(param(0))} = undefined;`);
					break;

				default:
					if (!(optimise & COMPILER_OPT_FLAGS.SKIP_DOMAIN_MEM)) {
						// not required push oppcode, because state should store active
						emitDomainMemOppcodes(state);
					}

					if ((z.name <= Bytecode.LI8 && z.name >= Bytecode.SF64)) {
						state.emitMain(`//unknown instruction ${BytecodeName[q[i].name]}`);
						//console.log(`unknown instruction ${BytecodeName[q[i].name]} (method N${methodInfo.index()})`)
						return {
							error:  {
								message: 'unhandled instruction ' + z,
								reason: COMPILATION_FAIL_REASON.UNHANDLED_INSTRUCTION
							}
						};
					}
			}
		}

		/* DIRTY */
		currentCatchBlocks = catchEnd ? catchEnd[z.position] : null;
		if (currentCatchBlocks) {
			const lastCatchBlocks = state.openTryCatchGroups.pop();

			if (lastCatchBlocks) {
				emitCloseTryCatch(state, lastCatchBlocks);
			}

		}
	}

	if (state.openTryCatchGroups.length > 0) {
		const lastCatchBlocks = state.openTryCatchGroups.pop();

		if (lastCatchBlocks) {
			emitCloseTryCatch(state, lastCatchBlocks);
		}
	}

	if (genBrancher) {
		// close switch
		state.emitEndMain();
		// close while
		state.emitEndMain();
	}

	// close closure
	state.emitEndMain();

	const locals = [];

	for (const l of optionalLocalVars) {
		if (!l) {
			continue;
		}

		if (l.die) {
			locals.push(`${namesIndent}// local${l.index} is assigned before read, skip init`);
		}
		// todo: this is not 100% correct yet:
		locals.push(`${namesIndent}let local${l.index} = undefined`);

		// for NO_ES mode we will generate REST as copy of arguments
		// TODO: Move this to `emitAnnotationOld`
		if (!useESArguments) {
			if (l.index == params.length + 1 && !l.die) {
				// eslint-disable-next-line max-len
				locals.push(`    if(arguments && arguments.length) { local${l.index} = context.sec.createArrayUnsafe(Array.from(arguments).slice(${params.length})); }`);
				locals.push(`    else { local${l.index} = context.emptyArray; }`);
			}
		}
	}

	if (!state.noHoistMultiname) {
		for (let i = 0, l = this.state.names.length; i < l; i++) {
			state.emitHead(`let ${emitInlineMultiname(state, i)} = context.names[${i}];`, namesIndent);
		}
	} else {
		state.emitHead('let $names = context.names;', namesIndent);
	}

	js0[LOCALS_POS] = locals.join('\n');

	const genHeader = ['const AX_CLASS_SYMBOL = context.AX_CLASS_SYMBOL;'];
	const genBody = [];

	let resulMain = state.mainBlock;
	if (USE_OPT(lexGen)) {
		genHeader.push(lexGen.genHeader(state.indent));
		genBody.push(lexGen.genBody(state.indent));

		// mutated generated codeblock
		resulMain = lexGen.genPost(resulMain);
	}

	const scriptHeader =
`/*
	Index: ${meta.index}
	Path:  ${meta.classPath}
	Type:  ${meta.type}
	Kind:  ${meta.kind}
	Super: ${meta.superClass || '-'}
	Return: ${meta.returnType}
*/\n\n`;

	const w =
		scriptHeader +
		genHeader.join('\n') +
		state.headerBlock.join('\n') + '\n' +
		genBody.join('\n') + '\n' +
		resulMain.join('\n');

	const hasError = w.indexOf(UNDERRUN) > -1;

	const compiled = generateFunc(w, meta.filePath);

	let underrunLine = -1;

	if (hasError) {
		underrunLine = w.split('\n').findIndex(v => v.indexOf(UNDERRUN) >= 0) + 3;
	}

	// reset lexer
	USE_OPT(lexGen) && lexGen.reset();

	Stat.end();

	let errorMessage = null;
	if (hasError) {
		errorMessage = {
			message:`STACK UNDERRUN at http://jit/${meta.filePath}.js:${underrunLine}`,
			reason: COMPILATION_FAIL_REASON.UNDERRUN,
		};
	}

	return {
		names: names,
		compiled,
		error : errorMessage
	};
}

export class Context {
	/*jit internal*/ readonly mi: MethodInfo;
	private readonly savedScope: Scope;
	private readonly rn: Multiname;
	private readonly sec: AXSecurityDomain
	/*jit internal*/ readonly abc: ABCFile
	private readonly names: Multiname[]
	/*jit internal*/ readonly jsGlobal: Object = jsGlobal;
	/*jit internal*/ readonly axCoerceString: Function = axCoerceString;
	/*jit internal*/ readonly axCheckFilter: Function = axCheckFilter;
	/*jit internal*/ readonly internNamespace: Function = internNamespace;
	private domain: any;

	public readonly emptyArray: any;
	public readonly AX_CLASS_SYMBOL = IS_AX_CLASS;
	public static readonly HAS_NEXT_INFO = new HasNext2Info(null,0);

	constructor(mi: MethodInfo, savedScope: Scope, names: Multiname[]) {
		this.mi = mi;
		this.savedScope = savedScope;
		this.rn = new Multiname(mi.abc, 0, null, null, null, null, true);
		this.abc = mi.abc;
		this.sec = mi.abc.applicationDomain.sec;
		this.names = names;
		this.emptyArray = Object.create(this.sec.AXArray.tPrototype);
		this.emptyArray.value = [];
	}

	get domainMemory(): DataView {
		if (!this.domain) {
			this.domain = (<any> this.sec).flash.system.ApplicationDomain.axClass.currentDomain;

			if (!this.domain) {
				console.warn('[JIT] Try access to domainMemory on unresolved ApplicationDomain!');
				return null;
			}
		}

		return this.domain.internal_memoryView;
	}

	/**
	 * Coerce returned value to type
	 * @param value
	 */
	coerceReturn(value: any): any {
		const type = this.mi.getType();
		return type ? type.axCoerce(value) : value;
	}

	createFunction (methodId: number, scope: Scope, hasDynamicScope: boolean, parentMethodId: number): AXFunction {
		const methodInfo = this.abc.getMethodInfo(methodId);

		if (parentMethodId !== undefined) {
			methodInfo.parentInfo = methodInfo.parentInfo || this.abc.getMethodInfo(parentMethodId);
		}

		return this.sec.createFunction(methodInfo, scope, hasDynamicScope);
	}

	escXElem(value: string): string {
		return escapeElementValue(this.sec, value);
	}

	escXAttr(value: string): string {
		return escapeAttributeValue(value);
	}

	/**
	 * Execute JS hook
	 */
	executeHook(context: any, name: string) {
		const hook = METHOD_HOOKS[name];
		if (hook) {
			hook.hook(context);
		}
	}

	/**
	* Generate static import for builtins
	*/
	getTopLevel(mnId: number, name?: string): any {
		const prop = this.savedScope.findScopeProperty(this.names[mnId], true, false);

		if (name) {
			return prop[name];
		}
		return prop;
	}

	/**
	 * Generate static import of object
	 */
	getStaticImportExt(namespace: string, name: string = undefined): any {
		return getExtClassField(name, namespace);
	}

	typeof(object: any): string {
		const type = typeof object;
		const sec = this.sec;

		switch (type) {
			case 'boolean':
				return 'Boolean';
			case 'object':
				if (object === null) {
					return 'object';
				}

				if (sec.AXXMLList.dPrototype.isPrototypeOf(object) || sec.AXXML.dPrototype.isPrototypeOf(object)) {
					return 'xml';
				}

				if (sec.AXNumber.dPrototype.isPrototypeOf(object)) {
					return 'number';
				}

				if (sec.AXBoolean.dPrototype.isPrototypeOf(object)) {
					// what???.
					return 'Boolean';
				}

				if (sec.AXString.dPrototype.isPrototypeOf(object)) {
					return 'string';
				}
		}

		return type;
	}

	call(value: AXCallable, obj: ASObject, pp: any[], scope: Scope = null): any {
		if (scope && (<any>value.methodInfo?.trait?.name)?.name == 'getDefinitionByName') {
			return this.getdefinitionbyname(scope, obj, pp);
		}
		validateCall(this.sec, value, pp.length);
		return value.axApply(obj, pp);
	}

	getdefinitionbyname(scope: Scope, _: any, args: any[]): AXClass {
		const info = (<ScriptInfo>(<any>scope.global.object).scriptInfo);
		// pp can be XMList, that required to conversion
		return info.abc.applicationDomain.getClass(Multiname.FromSimpleName(args[0].toString()));
	}

	getpropertydyn(mn: Multiname | number, obj: ASObject): ASObject {
		const b = this.sec.box(obj);

		if (typeof mn === 'number')
			return b.axGetNumericProperty(mn);

		const temp = b['$Bg' + mn.name];

		if (temp != undefined && typeof temp !== 'function')
			return temp;

		return b.axGetProperty(mn);
	}

	setproperty(mn: Multiname, value: any, obj: AXClass | null) {

		if (obj == void 0) {

			throw this.sec.createError('Error',
				// eslint-disable-next-line max-len
				`[AVM2] Unexpected property assignment: ${typeof obj}[${JSON.stringify(mn?.name)}] = ${value?.toString()}`
			);
		}

		if (needFastCheck()) {
			// unsafe SET into plain Object
			if (!obj[IS_AX_CLASS]) {
				obj[mn.name] = value;
				return;
			}

			// Hubrid
			// Mom is Human, Dad is Marsian
			// and it not has a axSetProp
			if (obj[IS_EXTERNAL_CLASS]) {
				// create prop and proxy to JS side.
				ASObject.prototype.axSetProperty.call(obj, mn, value, <any>Bytecode.INITPROPERTY);
				Object.defineProperty(obj, mn.name, { value, configurable: true, writable: true });
				return;
			}
		}

		if (typeof mn === 'number') {
			return obj.axSetNumericProperty(mn, value);
		}

		obj.axSetProperty(mn, value, <any>Bytecode.INITPROPERTY);
	}

	deleteproperty(name: string | number | Multiname, obj: AXObject) {
		const b = this.sec.box(obj);

		if (typeof name === 'number' || typeof name === 'string')
			return delete b[name];

		return b.axDeleteProperty(name);
	}

	/**
	 * Fast constructor for compile-time knowned external classes, like box2D or nape
	 */
	constructExt(ctor: AXClass, args: any[], mn?: Multiname): AXObject {
		mn = mn || ctor.classInfo.instanceInfo.getName();

		return extClassConstructor(mn, args);
	}

	/**
	 * Fast constructor for strictly known non-interactive classes, that not required checks
	 */
	constructFast(ctor: AXClass, args: any[], mn?: Multiname): AXObject {
		// todo Check this statically, we can check external class name in compile time
		if (needFastCheck()) {
			const extConsructor = this.constructExt(ctor, args, mn);

			if (extConsructor) {
				return extConsructor;
			}
		}

		if (mn) {
			return axConstructFast(ctor[ctor.axResolveMultiname(mn)], args);
		}

		return axConstructFast(ctor, args);
	}

	/**
	 * Basic constructor for axObjects, slower that any others
	 */
	construct(obj: AXClass, pp: any[]): AXObject {
		const mn = obj.classInfo.instanceInfo.getName();

		const r = extClassConstructor(mn, pp);

		if (r != null)
			return r;

		// if (mn.name.indexOf("b2") >= 0)
		//     console.log("*B2: " + mn.name)

		validateConstruct(this.sec, obj, pp.length);
		return obj.axConstruct(pp);
	}

	constructprop(mn: Multiname, obj: AXClass, pp: any[]) {
		const r = extClassConstructor(mn, pp);

		if (r != null)
			return r;

		// if (mn.name.indexOf("b2") >= 0)
		//     console.log("B2: " + mn.name)

		const b = this.sec.box(obj);
		const name = b.axResolveMultiname(mn);
		const ctor = b[name];

		validateConstruct(b.sec, ctor, pp.length);
		return ctor.axConstruct(pp);
	}

	pushwith(scope: Scope, obj: AXObject) {
		const b = this.sec.box(obj);
		return (scope.object === b && scope.isWith == true) ? scope : new Scope(scope, b, true);
	}

	hasnext2(obj: AXObject, name: number): [AXObject, number] {
		const info = Context.HAS_NEXT_INFO;

		if (obj == undefined) {
			return [null, 0];
		}

		info.next(obj[IS_AX_CLASS] ? obj : this.sec.box(obj), name);
		return [info.object, info.index];
	}

	runtimename(mn: Multiname, propName: Multiname & ASClass | string , nsName?: string): Multiname {
		this.rn.resolved = {};
		this.rn.script = null;
		this.rn.numeric = false;
		this.rn.id = mn.id;
		this.rn.kind = mn.kind;

		if (mn.isRuntimeName()) {
			let name = <any>propName;

			// so, undef and null is valid keys, but unsafe
			if (name == void 0) {
				console.warn(`[AVM2 SetProperty DYN] Key is ${name}, are you sure that this is valid?`);
				name = '' + name;
				// Unwrap content script-created AXQName instances.
			} else if (typeof name === 'object' && name.axClass === name.sec.AXQName) {
				name = name.name;
				release || assert(name instanceof Multiname);

				this.rn.kind = mn.isAttribute() ? CONSTANT.RTQNameLA : CONSTANT.RTQNameL;
				this.rn.id = name.id;
				this.rn.name = name.name;
				this.rn.namespaces = name.namespaces;

				return this.rn;
			} else if (typeof name === 'number') {
				this.rn.numeric = true;
				this.rn.numericValue = name;
			} else {
				const coerce = axCoerceName(name);

				if (isNumeric(coerce)) {
					this.rn.numeric = true;
					this.rn.numericValue = +coerce;
				}
			}

			this.rn.name = name;
			this.rn.id = -1;
		} else {
			this.rn.name = mn.name;
			nsName = <string>propName;
		}

		if (mn.isRuntimeNamespace()) {
			let ns = <any> nsName;
			// Unwrap content script-created AXNamespace instances.
			if (ns._ns) {
				release || assert(ns.sec && ns.axClass === ns.sec.AXNamespace);
				ns = ns._ns;
			}
			this.rn.namespaces = [ns];
			this.rn.id = -1;
		} else {
			this.rn.namespaces = mn.namespaces;
		}

		return this.rn;
	}
}
