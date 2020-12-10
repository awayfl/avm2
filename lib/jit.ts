import { assert } from '@awayjs/graphics';
import { Scope } from './run/Scope';
import { HasNext2Info } from './run/HasNext2Info';
import { AXSecurityDomain } from './run/AXSecurityDomain';
import { validateCall } from './run/validateCall';
import { validateConstruct } from './run/validateConstruct';
import { axCoerceString } from './run/axCoerceString';
import { axCheckFilter } from './run/axCheckFilter';
import { release } from '@awayfl/swf-loader';
import { Multiname } from './abc/lazy/Multiname';
import { CONSTANT } from './abc/lazy/CONSTANT';
import { MethodInfo } from './abc/lazy/MethodInfo';
import { internNamespace } from './abc/lazy/internNamespace';
import { AXClass, IS_AX_CLASS } from './run/AXClass';
import { axCoerceName } from './run/axCoerceName';
import { isNumeric, jsGlobal } from '@awayfl/swf-loader';
import { ABCFile } from './abc/lazy/ABCFile';
import { ScriptInfo } from './abc/lazy/ScriptInfo';
import { ExceptionInfo } from './abc/lazy/ExceptionInfo';
import { Bytecode } from './Bytecode';
import { ASObject } from './nat/ASObject';
import { InstanceInfo } from './abc/lazy/InstanceInfo';
import { ClassInfo } from './abc/lazy/ClassInfo';
import { MethodTraitInfo } from './abc/lazy/MethodTraitInfo';
import { namespaceTypeNames } from './abc/lazy/NamespaceType';
import { escapeAttributeValue, escapeElementValue } from './natives/xml';
import { COMPILER_DEFAULT_OPT, COMPILER_OPT_FLAGS, COMPILATION_FAIL_REASON } from './flags';

// generators
import { affilate, Instruction, IAffilerResult, IAffilerError } from './gen/affiliate';
import { TinyConstructor } from './gen/TinyConstructor';
import { TweenCallSaver } from './gen/CallBlockSaver';
import { FastCall, ICallEntry } from './gen/FastCall';

import { Stat } from './gen/Stat';

import {
	ComplexGenerator,
	PhysicsLex,
	TopLevelLex
} from './gen/LexImportsGenerator';

import {
	extClassContructor,
	getExtClassField,
	emitIsAXOrPrimitive,
	emitIsAX,
	IS_EXTERNAL_CLASS,
	needFastCheck
} from './ext/external';
import { TRAIT } from './abc/lazy/TRAIT';
import { AXCallable } from './run/AXCallable';
import { ASClass } from './nat/ASClass';
import { AXObject } from './run/AXObject';
import { COERCE_MODE_ENUM, Settings } from './Settings';

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
	body += `\n//# sourceURL=http://jit/${path}.js`;

	try {
		return  new Function('context', body);
	} catch (e) {
		throw new Error('Compiler error:\n\n' + body);
	}
}

function escape(name: string) {
	return JSON.stringify(name);
}

const validTest = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
function validate(name: string) {
	return validTest.test(name);
}

const CLASS_NAME_METHOD_NAME: StringMap<number> = {};

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

let SCRIPT_ID = 0;

export function compile(methodInfo: MethodInfo, options: ICompilerOptions = {}): ICompilerProcess {
	const {
		optimise = COMPILER_DEFAULT_OPT,
		scope,
	} = options;

	// lex generator
	const lexGen = new ComplexGenerator([
		new PhysicsLex({ box2D: false }), // generate static aliases for Physics engine
		new TopLevelLex() // generate alias for TopLevel props
	]);

	const blockSaver = new TweenCallSaver();

	const tinyCtr = new TinyConstructor();

	Stat.begin('');

	const fastCall = new FastCall(lexGen, scope);

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

	const prefix = ('' + (SCRIPT_ID++)).padLeft('0', 4);
	const funcName = (methodInfo.getName()).replace(/([^a-z0-9]+)/gi, '_');

	let fullPath = `__root__/${prefix}_${funcName || 'unknown'}`;
	let path = fullPath;
	let methodName = funcName;
	let isMemeber = true;
	let methodType = 'Public';
	let superClass = undefined;

	if (methodInfo.trait) {
		if (methodInfo.trait.holder instanceof ClassInfo) {
			path =  methodInfo.trait.holder.instanceInfo.getClassName().replace(/\./g, '/');
			isMemeber = false;
		} else if (methodInfo.trait.holder instanceof InstanceInfo) {
			path = methodInfo.trait.holder.getClassName().replace(/\./g, '/');
			superClass =  methodInfo.trait.holder.getSuperName()?.
				toFQNString(false).replace(/\./g, '/');
		}
		if (methodInfo.trait instanceof MethodTraitInfo) {
			methodName = (<Multiname>methodInfo.trait.name).name;
			methodType = namespaceTypeNames[(<Multiname>methodInfo.trait.name).namespace.type];
		}

		if (methodInfo.trait && methodInfo.trait.kind === TRAIT.Getter) {
			methodName = 'get_' + methodName;
		}

		if (methodInfo.trait && methodInfo.trait.kind === TRAIT.Setter) {
			methodName = 'set_' + methodName;
		}

		if (methodInfo.isConstructor) {
			//constructor
			methodName = 'constructor';
		} else {
			// member
			methodName  = isMemeber ?  ('m_' + methodName) : methodName;
		}

		fullPath = path + '/' + methodName;

		if (CLASS_NAME_METHOD_NAME[fullPath] !== undefined) {
			const index = CLASS_NAME_METHOD_NAME[fullPath] = CLASS_NAME_METHOD_NAME[fullPath] + 1;
			fullPath += '$' + index;
		} else {
			CLASS_NAME_METHOD_NAME[fullPath] = 0;
		}
	}

	// for instances
	if (methodInfo.instanceInfo) {
		path = methodInfo.instanceInfo.getClassName().replace(/\./g, '/');
		methodName = methodInfo.isConstructor ? 'constructor' : funcName;
		superClass = methodInfo.instanceInfo.getSuperName()?.
			toFQNString(false).replace(/\./g, '/');
		fullPath = path + '/' + methodName;
	}

	const validMethodName = validate(methodName);
	const validPathName = validate(path.replace('/','_'));

	if (!validMethodName && !validPathName) {
		return {
			error: {
				message: `Invalid method (${methodName}) and path (${path}) name, falling to interpret`,
				reason: COMPILATION_FAIL_REASON.MANGLED_CLASSNAME
			}
		};
	}

	const hookMethodPath = `${path}${isMemeber ? '::' : '.'}${methodName}`;
	const scriptHeader =
`/*
	Index: ${methodInfo.index()}
	Path:  ${hookMethodPath}
	Type:  ${methodType}
	Super: ${superClass || '-'}
	Return: ${methodInfo.getTypeName()?.toString() || '*'}
*/\n\n`;
	const {
		error,
		jumps,
		catchStart,
		catchEnd,
		set : q
	} = affilate(methodInfo) as IAffilerResult & IAffilerError;

	// if affilate a generate error, broadcast it
	if (error) {
		Stat.drop();

		// if a error is not debuggable, drop compilation
		if (error.reason !== COMPILATION_FAIL_REASON.UNDERRUN || !(optimise & COMPILER_OPT_FLAGS.DEBUG_UNDERRUN)) {
			return { error };
		}
	}

	const abc = methodInfo.abc;
	const body = methodInfo.getBody();
	const maxstack = body.maxStack;
	const maxlocal = body.localCount - 1;
	const maxscope = body.maxScopeDepth - body.initScopeDepth;

	const js0 = [];
	const js = [];

	let idnt: string = '';
	let idnLen = 0;
	// move correr by 4 spaces - 1, for separate idnt =)
	const moveIdnt = (offset: number) => {
		idnLen += offset * 4;
		if (idnLen < 0) idnLen = 0;

		return idnt = (' ').repeat(idnLen ? idnLen - 1 : 0);
	};
	const openTryCatchBlockGroups: ExceptionInfo[][] = [];
	//	creates a catch condition for a list of ExceptionInfo
	const createCatchConditions = (catchBlocks: ExceptionInfo[]) => {
		js.push(`${idnt} catch(e){`);

		moveIdnt(1);

		js.push(`${idnt} // in case this is a error coming from stack0.__fast when stack0 is undefined,`);
		js.push(`${idnt} // we convert it to a ASError, so that avm2 can still catch it`);
		js.push(`${idnt} if (e instanceof TypeError) {`);
		js.push(`${idnt}     var _e = context.sec.createError("TypeError", {code:1065, message:e.message})`);
		js.push(`${idnt}     _e.source = e; e = _e;`);
		js.push(`${idnt} }`);

		js.push(`${idnt} stack0 = e;`);
		let lastCatchItem;
		for (let i = 0; i < catchBlocks.length; i++) {
			const typeName = catchBlocks[i].getType();
			if (!typeName) {
				lastCatchItem = `${idnt} { p = ${catchBlocks[i].target}; continue; };`;
				continue;
			} else {
				let n = names.indexOf(typeName);
				if (n < 0) {
					n = names.length;
					names.push(typeName);
					js0.push(`    let name${n} = context.names[${n}];`);
				}
				js.push(`${idnt} const errorClass$${i} = context.sec.application.getClass(name${n});`);
				js.push(`${idnt} if(errorClass$${i} && errorClass$${i}.axIsType(e))`);
				js.push(`${idnt}     { p = ${catchBlocks[i].target}; continue; };`);
			}
		}
		if (lastCatchItem)
			js.push(lastCatchItem);

		// if error was not catched by now, we throw it
		js.push(`${idnt} throw e;`);

		moveIdnt(-1);

		js.push(`${idnt} }`);
		/*for (var i = 0; i < createFinally.length; i++) {
			js.push(`            ${indent}${createFinally[i]}`);
		}*/
	};
	//	closes all try-catch blocks. used when entering a new case-block
	const closeAllTryCatch = () => {
		//js.push(`//CLOSE ALL`);

		for (let i = 0; i < openTryCatchBlockGroups.length; i++) {
			moveIdnt(-1);
			js.push(`${idnt} }`);
			createCatchConditions(openTryCatchBlockGroups[i]);
		}
	};
	//	reopen all try-catch blocks. used when entering a new case-block
	const openAllTryCatch = () => {
		for (let i = 0; i < openTryCatchBlockGroups.length; i++) {
			js.push(`${idnt} try {`);
			moveIdnt(1);
		}
	};

	let temp = false;
	let domMem = false;
	for (const q_i of q) {
		const b = q_i.name;

		if (b == Bytecode.NEWOBJECT || b == Bytecode.SWAP || b == Bytecode.HASNEXT2) {
			temp = true;
		}

		domMem = domMem || (b >= Bytecode.LI8 && b <= Bytecode.SF64);
	}

	const params = methodInfo.parameters;

	const underrun = '[stack underrun]';
	let paramsShift = 0;

	// shift function body
	moveIdnt(1);

	if (optimise & COMPILER_OPT_FLAGS.USE_ES_PARAMS) {
		const args = [];
		for (let i = 0; i < params.length; i++) {
			const p = params[i];
			const arg = { name: 'local' + (i + 1), value: null, type: '' };

			if (p.hasOptionalValue()) {
				switch (p.optionalValueKind) {
					case CONSTANT.Utf8:
						arg.value = `${escape(abc.getString(p.optionalValueIndex))}`;
						break;
					default:
						arg.value = `${p.getOptionalValue()}`;
				}
			}

			const t = p.getType();
			t && (arg.type = t.name);

			args[i] = arg;
		}

		if (methodInfo.needsRest()) {
			args.push({ name: '...args' });
		}

		const argsFilled = args
			.map((e) => {
				return e.value
					? `${e.name} /* ${e.type || '*'} */ = ${e.value}`
					: `${e.name} /* ${e.type || '*'} */`;
			})
			.join(', ');

		const mname =  methodName.replace(/([^a-z0-9]+)/gi, '_');

		js0.push(`${idnt} return function compiled_${mname}(${argsFilled}) {`);

		moveIdnt(1);

		js0.push(`${idnt} let local0 = this === context.jsGlobal ? context.savedScope.global.object : this;`);

		for (const a of args) {
			if (a.type === 'String') {
				const name = a.name;
				js0.push(`${idnt} /* Force string coerce */`);
				js0.push(`${idnt} ${name} = (${name} && typeof ${name} !=='string') ? ${name}.toString() : ${name};`);
			}
		}

		if (methodInfo.needsRest()) {
			js0.push(`${idnt} let local${params.length + 1} = context.sec.createArrayUnsafe(args);`);
			paramsShift += 1;
		}

		if (methodInfo.needsArguments()) {
			js0.push(`${idnt} let local${params.length + 1} = context.sec.createArrayUnsafe(Array.from(arguments));`);
			paramsShift += 1;
		}
	} else {
		js0.push(`${idnt} return function compiled_${methodName.replace(/([^a-z0-9]+)/gi, '_')}() {`);

		for (let i: number = 0; i < params.length; i++)
			if (params[i].hasOptionalValue()) {
				js0.push(`${idnt} let argnum = arguments.length;`);
				break;
			}

		js0.push(`${idnt} let local0 = this === context.jsGlobal ? context.savedScope.global.object : this;`);

		for (let i: number = 0; i < params.length; i++) {
			const p = params[i];
			js0.push(`${idnt} let local${(i + 1)} = arguments[${i}];`);

			if (params[i].hasOptionalValue())
				switch (p.optionalValueKind) {
					case CONSTANT.Utf8:
						// eslint-disable-next-line max-len
						js0.push(`${idnt} if (argnum <= ${i}) local${(i + 1)} = context.abc.getString(${p.optionalValueIndex});`);
						break;
					default:
						js0.push(`${idnt} if (argnum <= ${i}) local${(i + 1)} = ${p.getOptionalValue()};`);
						break;
				}
		}
	}

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
		js0.push(`${idnt} let stack${i} = undefined;`);

	for (let i: number = 0; i < maxscope; i++)
		js0.push(`${idnt} let scope${i} = undefined;`);

	if (temp)
		js0.push(`${idnt} let temp = undefined;`);

	if (domMem)
		js0.push(`${idnt} let domainMemory; // domainMemory`);

	js0.push(`${idnt} let tr = undefined;`);

	const names: Multiname[] = [];

	const nameIdnt = idnt;
	const getname = (n: number) => {
		const mn = abc.getMultiname(n);
		let i = names.indexOf(mn);
		if (i < 0) {
			i = names.length;
			names.push(mn);
			js0.push(`${nameIdnt} let name${i} = context.names[${i}];`);
		}
		return 'name' + i;
	};

	js0.push(`${idnt} let sec = context.sec;`);

	const genBrancher = jumps.length > 1 || catchStart;

	if (METHOD_HOOKS && METHOD_HOOKS[hookMethodPath + '__begin']) {
		js.push(`${idnt} /* ATTACH METHOD HOOK */`);
		js.push(`${idnt} context.executeHook(local0, '${hookMethodPath + '__begin'}')`);
	}

	js.push(`${idnt} `);

	const catches = catchStart
		? Object.keys(catchStart).length
		: 0;

	const useLoopGuard =
	(
		Settings.ENABLE_LOOP_QUARD
		&& genBrancher
		// every cathch has 2 jumps, ignore it
		&& (jumps.length - catches * 2) >= Settings.LOOP_GUARD_MIN_BRANCHES
	);

	if (genBrancher) {
		if (useLoopGuard) {
			js.push(`${idnt} let tick = 0;`);
		}

		js.push(`${idnt} let p = 0;`);
		js.push(`${idnt} while (true) {`);

		moveIdnt(1);

		if (useLoopGuard) {
			const loops = Settings.LOOP_GUARD_MAX_LOOPS;
			js.push(
				`${idnt} if (tick++ > ${loops}) {\n`
				+ `${moveIdnt(1)} throw 'To many loops (> ${loops}) in "${hookMethodPath}" at '+ p +`
				+ '\',method was dropped to avoid stucking\';\n'
				+ `${moveIdnt(-1)} };`
			);
		}

		js.push(`${idnt} switch (p) {`);
	}

	let currentCatchBlocks: ExceptionInfo[];
	let lastZ: Instruction;
	let z: Instruction;

	// case + case int
	genBrancher && moveIdnt(2);

	for (let i: number = 0; i < q.length; i++) {
		z && (lastZ = z);
		z = q[i];
		USE_OPT(fastCall) && fastCall.killFar(i);

		if (jumps.indexOf(z.position) >= 0) {
			// if we are in any try-catch-blocks, we must close them
			if (openTryCatchBlockGroups) closeAllTryCatch();

			if (USE_OPT(blockSaver)) {
				blockSaver.drop();
			}

			if (genBrancher) {
				moveIdnt(-1);
				js.push(`${idnt} case ${z.position}:`);
				moveIdnt(1);
			}
			// now we reopen all the try-catch again
			if (openTryCatchBlockGroups) openAllTryCatch();
		}

		currentCatchBlocks = catchStart ? catchStart[z.position] : null;
		if (currentCatchBlocks) {
			openTryCatchBlockGroups.push(currentCatchBlocks);

			js.push(`${idnt} try {`);
			moveIdnt(1);
		}

		if (Settings.PRINT_BYTE_INSTRUCTION) {
			js.push(`${idnt} //${BytecodeName[z.name]} ${z.params.join(' / ')} -> ${z.returnTypeId}`);
		}

		const stackF = (n: number) => {
			return ((z.stack - 1 - n) >= 0)
				? `stack${(z.stack - 1 - n)}`
				: `/*${underrun} ${z.stack - 1 - n}*/ stack0`;
		};

		const stack0 = stackF(0);
		const stack1 = stackF(1);
		const stack2 = stackF(2);
		const stack3 = stackF(3);
		const stackN = stackF(-1);

		const scope = z.scope > 0 ? `scope${(z.scope - 1)}` : 'context.savedScope';
		const scopeN = 'scope' + z.scope;

		const local = (n: number) => 'local' + n;

		const param = (n: number) => z.params[n];
		if (z.stack < 0) {
			js.push(`${idnt} // unreachable`);
		} else {
			let localIndex = 0;
			switch (z.name) {
				case Bytecode.LABEL:
					break;
				case Bytecode.DXNSLATE:
					js.push(`${idnt} ${scope}.defaultNamespace = context.internNamespace(0, ${stack0});`);
					break;
				case Bytecode.DEBUGFILE:
					break;
				case Bytecode.DEBUGLINE:
					break;
				case Bytecode.DEBUG:
					break;
				case Bytecode.THROW:
					js.push(`${idnt} throw ${stack0};`);
					break;
				case Bytecode.GETLOCAL:
					localIndex = param(0);
					optionalLocalVars[localIndex] && (optionalLocalVars[localIndex].read++);

					js.push(`${idnt} ${stackN} = ${local(localIndex)};`);
					break;
				case Bytecode.SETLOCAL:
					localIndex = param(0);

					if (optionalLocalVars[localIndex]) {
						optionalLocalVars[localIndex].write++;

						if (!optionalLocalVars[localIndex].read) {
							optionalLocalVars[localIndex].die = true;
						}
					}

					js.push(`${idnt} ${local(localIndex)} = ${stack0};`);
					break;

				case Bytecode.GETSLOT:
					// slots can be get/set only on AX objects
					js.push(`${idnt} ${stack0} = ${stack0}.axGetSlot(${param(0)});`);
					break;
				case Bytecode.SETSLOT:
					js.push(`${idnt} ${stack1}.axSetSlot(${param(0)}, ${stack0});`);
					break;

				case Bytecode.GETGLOBALSCOPE:
					js.push(`${idnt} ${stackN} = context.savedScope.global.object;`);
					break;
				case Bytecode.PUSHSCOPE:
					// extends can be used only on AXObject
					js.push(`${idnt} ${scopeN} = ${scope}.extend(${stack0});`);
					break;
				case Bytecode.PUSHWITH:
					js.push(`${idnt} ${scopeN} = context.pushwith(${scope}, ${stack0});`);
					break;
				case Bytecode.POPSCOPE:
					js.push(`${idnt} ${scope} = undefined;`);
					break;
				case Bytecode.GETSCOPEOBJECT:
					js.push(`${idnt} ${stackN} = scope${param(0)}.object;`);
					break;

				case Bytecode.NEXTNAME:
					js.push(`${idnt} ${stack1} = sec.box(${stack1}).axNextName(${stack0});`);
					break;
				case Bytecode.NEXTVALUE:
					js.push(`${idnt} ${stack1} = sec.box(${stack1}).axNextValue(${stack0});`);
					break;
				case Bytecode.HASNEXT:
					js.push(`${idnt} ${stack1} = sec.box(${stack1}).axNextNameIndex(${stack0});`);
					break;
				case Bytecode.HASNEXT2:
					js.push(`${idnt} temp = context.hasnext2(${local(param(0))}, ${local(param(1))});`);
					js.push(`${idnt} ${local(param(0))} = temp[0];`);
					js.push(`${idnt} ${local(param(1))} = temp[1];`);
					js.push(`${idnt} ${stackN} = ${local(param(1))} > 0;`);
					break;
				case Bytecode.IN:
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stack1} = (${stack1} && ${stack1}.axClass === sec.AXQName) ? obj.axHasProperty(${stack1}.name) : ${stack0}.axHasPublicProperty(${stack1});`);
					break;

				case Bytecode.DUP:
					js.push(`${idnt} ${stackN} = ${stack0};`);
					break;
				case Bytecode.POP:
					//js.push(`${idnt};`)
					break;
				case Bytecode.SWAP:
					js.push(`${idnt} temp = ${stack0};`);
					js.push(`${idnt} ${stack0} = ${stack1};`);
					js.push(`${idnt} ${stack1} = temp;`);
					js.push(`${idnt} temp = undefined;`);
					break;
				case Bytecode.PUSHTRUE:
					js.push(`${idnt} ${stackN} = true;`);
					break;
				case Bytecode.PUSHFALSE:
					js.push(`${idnt} ${stackN} = false;`);
					break;
				case Bytecode.PUSHBYTE:
					js.push(`${idnt} ${stackN} = ${param(0)};`);
					break;
				case Bytecode.PUSHSHORT:
					js.push(`${idnt} ${stackN} = ${param(0)};`);
					break;
				case Bytecode.PUSHINT:
					js.push(`${idnt} ${stackN} = ${abc.ints[param(0)]};`);
					break;
				case Bytecode.PUSHUINT:
					js.push(`${idnt} ${stackN} = ${abc.uints[param(0)]};`);
					break;
				case Bytecode.PUSHDOUBLE:
					js.push(`${idnt} ${stackN} = ${abc.doubles[param(0)]};`);
					break;
				case Bytecode.PUSHSTRING:
					js.push(`${idnt} ${stackN} = ${escape(abc.getString(param(0)))};`);
					break;
				case Bytecode.PUSHNAN:
					js.push(`${idnt} ${stackN} = NaN;`);
					break;
				case Bytecode.PUSHNULL:
					js.push(`${idnt} ${stackN} = null;`);
					break;
				case Bytecode.PUSHUNDEFINED:
					js.push(`${idnt} ${stackN} = undefined;`);
					break;
				case Bytecode.IFEQ:
					js.push(`${idnt} if (${stack0} == ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFNE:
					js.push(`${idnt} if (${stack0} != ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFSTRICTEQ:
					js.push(`${idnt} if (${stack0} === ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFSTRICTNE:
					js.push(`${idnt} if (${stack0} !== ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFGT:
					js.push(`${idnt} if (${stack0} < ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFGE:
					js.push(`${idnt} if (${stack0} <= ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFLT:
					js.push(`${idnt} if (${stack0} > ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFLE:
					js.push(`${idnt} if (${stack0} >= ${stack1}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFFALSE:
					js.push(`${idnt} if (!${stack0}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.IFTRUE:
					js.push(`${idnt} if (${stack0}) { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.LOOKUPSWITCH: {
					const jj = z.params.concat();
					const dj = jj.shift();
					// eslint-disable-next-line max-len
					js.push(`${idnt} if (${stack0} >= 0 && ${stack0} < ${jj.length}) { p = [${jj.join(', ')}][${stack0}]; continue; } else { p = ${dj}; continue; };`);
					break;
				}
				case Bytecode.JUMP:
					js.push(`${idnt} { p = ${param(0)}; continue; };`);
					break;
				case Bytecode.INCREMENT:
					js.push(`${idnt} ${stack0}++;`);
					break;
				case Bytecode.DECREMENT:
					js.push(`${idnt} ${stack0}--;`);
					break;
				case Bytecode.INCLOCAL:
					js.push(`${idnt} ${local(param(0))}++;`);
					break;
				case Bytecode.DECLOCAL:
					js.push(`${idnt} ${local(param(0))}--;`);
					break;
				case Bytecode.INCREMENT_I:
					js.push(`${idnt} ${stack0} |= 0;`);
					js.push(`${idnt} ${stack0}++;`);
					break;
				case Bytecode.DECREMENT_I:
					js.push(`${idnt} ${stack0} |= 0;`);
					js.push(`${idnt} ${stack0}--;`);
					break;
				case Bytecode.INCLOCAL_I:
					js.push(`${idnt} ${local(param(0))} |= 0;`);
					js.push(`${idnt} ${local(param(0))}++;`);
					break;
				case Bytecode.DECLOCAL_I:
					js.push(`${idnt} ${local(param(0))} |= 0;`);
					js.push(`${idnt} ${local(param(0))}--;`);
					break;
				case Bytecode.NEGATE_I:
					js.push(`${idnt} ${stack0} = -(${stack0} | 0);`);
					break;
				case Bytecode.ADD_I:
					js.push(`${idnt} ${stack1} = (${stack1} | 0) + (${stack0} | 0);`);
					break;
				case Bytecode.SUBTRACT_I:
					js.push(`${idnt} ${stack1} = (${stack1} | 0) - (${stack0} | 0);`);
					break;
				case Bytecode.MULTIPLY_I:
					js.push(`${idnt} ${stack1} = (${stack1} | 0) * (${stack0} | 0);`);
					break;
				case Bytecode.ADD:
					js.push(`${idnt} ${stack1} += ${stack0};`);
					break;
				case Bytecode.SUBTRACT:
					js.push(`${idnt} ${stack1} -= ${stack0};`);
					break;
				case Bytecode.MULTIPLY:
					js.push(`${idnt} ${stack1} *= ${stack0};`);
					break;
				case Bytecode.DIVIDE:
					js.push(`${idnt} ${stack1} /= ${stack0};`);
					break;
				case Bytecode.MODULO:
					js.push(`${idnt} ${stack1} %= ${stack0};`);
					break;

				case Bytecode.LSHIFT:
					js.push(`${idnt} ${stack1} <<= ${stack0};`);
					break;
				case Bytecode.RSHIFT:
					js.push(`${idnt} ${stack1} >>= ${stack0};`);
					break;
				case Bytecode.URSHIFT:
					js.push(`${idnt} ${stack1} >>>= ${stack0};`);
					break;

				case Bytecode.BITAND:
					js.push(`${idnt} ${stack1} &= ${stack0};`);
					break;
				case Bytecode.BITOR:
					js.push(`${idnt} ${stack1} |= ${stack0};`);
					break;
				case Bytecode.BITXOR:
					js.push(`${idnt} ${stack1} ^= ${stack0};`);
					break;

				case Bytecode.EQUALS:
					js.push(`${idnt} ${stack1} = ${stack1} == ${stack0};`);
					break;
				case Bytecode.STRICTEQUALS:
					js.push(`${idnt} ${stack1} = ${stack1} === ${stack0};`);
					break;
				case Bytecode.GREATERTHAN:
					js.push(`${idnt} ${stack1} = ${stack1} > ${stack0};`);
					break;
				case Bytecode.GREATEREQUALS:
					js.push(`${idnt} ${stack1} = ${stack1} >= ${stack0};`);
					break;
				case Bytecode.LESSTHAN:
					js.push(`${idnt} ${stack1} = ${stack1} < ${stack0};`);
					break;
				case Bytecode.LESSEQUALS:
					js.push(`${idnt} ${stack1} = ${stack1} <= ${stack0};`);
					break;
				case Bytecode.NOT:
					js.push(`${idnt} ${stack0} = !${stack0};`);
					break;
				case Bytecode.BITNOT:
					js.push(`${idnt} ${stack0} = ~${stack0};`);
					break;
				case Bytecode.NEGATE:
					js.push(`${idnt} ${stack0} = -${stack0};`);
					break;
				case Bytecode.TYPEOF:
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stack0} = typeof ${stack0} === 'undefined' ? 'undefined' : context.typeof(${stack0});`);
					break;
				case Bytecode.INSTANCEOF:
					js.push(`${idnt} ${stack1} = ${stack0}.axIsInstanceOf(${stack1});`);
					break;
				case Bytecode.ISTYPE:
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stack0} = ${scope}.getScopeProperty(${getname(param(0))}, true, false).axIsType(${stack0});`);

					break;
				case Bytecode.ISTYPELATE:
					js.push(`${idnt} ${stack1} = ${stack0}.axIsType(${stack1});`);
					break;
				case Bytecode.ASTYPE:
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stack0} = ${scope}.getScopeProperty(${getname(param(0))}, true, false).axAsType(${stack0});`);
					break;

				case Bytecode.ASTYPELATE:
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stack1} = ${emitIsAXOrPrimitive(stack1)} ? ${stack0}.axAsType(${stack1}) : ${stack1};`);
					break;

				case Bytecode.CALL: {
					const pp = [];
					const obj = stackF(param(0) + 1);
					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					if (USE_OPT(blockSaver) && blockSaver.safe(obj)) {
						js.push(`${idnt} /* This call maybe a safe, ${blockSaver.constructor.name} */`);
					}

					// eslint-disable-next-line max-len
					js.push(`${idnt} ${obj} = context.call(${stackF(param(0) + 1)}, ${stackF(param(0))}, [${pp.join(', ')}]);`);

					break;
				}
				case Bytecode.CONSTRUCT: {
					const pp = [];

					for (let j = 1; j <= param(0); j++) {
						pp.push(stackF(param(0) - j));
					}

					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stackF(param(0))} = context.construct(${stackF(param(0))}, [${pp.join(', ')}]);`);

					break;
				}
				case Bytecode.CALLPROPERTY: {
					const mn = abc.getMultiname(param(1));
					const pp = [];
					for (let j: number = 0; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					const obj = pp.shift();
					if (abc.getMultiname(param(1)).name == 'getDefinitionByName') {
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stackF(param(0))} = context.getdefinitionbyname(${scope}, ${obj}, [${pp.join(', ')}]);`);
					} else {
						let d;
						if (USE_OPT(fastCall) && (d = fastCall.sureThatFast(`${obj}`, mn.getMangledName()))) {
							const n = d.isMangled ? Multiname.getPublicMangledName(mn.name) : mn.name;
							fastCall.kill(`${obj}`);

							js.push(`${idnt} /* We sure that this safe call */ `);

							if (d.isFunc) {
								js.push(`${idnt} ${stackF(param(0))} = ${obj}['${n}'](${pp.join(', ')});`);
							} else {
								// eslint-disable-next-line max-len
								js.push(`${idnt} ${stackF(param(0))} = /*fast*/${obj}.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
							}
							break;
						}

						if (needFastCheck()) {
							js.push(`${idnt} if (!${emitIsAXOrPrimitive(obj)}) {`);
							// fast instruction already binded
							js.push(`${idnt}    ${stackF(param(0))} = ${obj}['${mn.name}'](${pp.join(', ')});`);
							js.push(`${idnt} } else {`);

							moveIdnt(1);
						}

						js.push(`${idnt} // ${mn}`);
						js.push(`${idnt} {`);

						moveIdnt(1);
						js.push(`${idnt} let t = ${obj};`);
						// eslint-disable-next-line max-len
						js.push(`${idnt} const m = ${obj}['$Bg${mn.name}'] || (t = sec.box(${obj}), t['$Bg${mn.name}']);`);
						js.push(`${idnt} if( typeof m === 'function' ) { `);
						js.push(`${idnt}     ${stackF(param(0))} = m.call(t${pp.length ? ', ' : ''}${pp.join(', ')});`);
						js.push(`${idnt} } else {  `);
						// eslint-disable-next-line max-len
						js.push(`${idnt}     ${stackF(param(0))} = ${obj}.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
						js.push(`${idnt} }`);

						moveIdnt(-1);
						js.push(`${idnt} }`);

						if (needFastCheck()) {
							moveIdnt(-1);
							js.push(`${idnt} }`);
						}
					}
					break;
				}
				case Bytecode.CALLPROPLEX: {
					const mn = abc.getMultiname(param(1));
					const pp = [];

					for (let j: number = 0; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					js.push(`${idnt} temp = sec.box(${pp.shift()});`);
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stackF(param(0))} = (typeof temp['$Bg${mn.name}'] === 'function')? temp['$Bg${mn.name}'](${pp.join(', ')}) : temp.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], true);`);
				}
					break;
				case Bytecode.CALLPROPVOID: {
					const mn = abc.getMultiname(param(1));
					const pp = [];

					for (let j: number = 0; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					const obj = pp.shift();
					{
						if (USE_OPT(fastCall) && fastCall.sureThatFast(obj)) {
							const n = fastCall.sureThatFast(obj).isMangled
								? Multiname.getPublicMangledName(mn.name)
								: mn.name;

							js.push(`${idnt} /* We sure that this safe call */ `);
							js.push(`${idnt} ${obj}['${n}'](${pp.join(', ')});`);

							fastCall.kill(`${obj}`);
							break;
						}
					}

					if (needFastCheck()) {
						js.push(`${idnt} if (!${emitIsAXOrPrimitive(obj)}) {`);
						js.push(`${idnt}     ${obj}['${mn.name}'](${pp.join(', ')});`);
						js.push(`${idnt} } else {`);

						moveIdnt(1);
					}

					js.push(`${idnt} // ${mn}`);
					js.push(`${idnt} {`);

					moveIdnt(1);
					js.push(`${idnt} let t = ${obj};`);
					js.push(`${idnt} const m = ${obj}['$Bg${mn.name}'] || (t = sec.box(${obj}), t['$Bg${mn.name}']);`);
					js.push(`${idnt} if( typeof m === 'function' ) { `);
					js.push(`${idnt}     m.call(t${pp.length ? ', ' : ''}${pp.join(', ')});`);
					js.push(`${idnt} } else {  `);
					js.push(`${idnt}    ${obj}.axCallProperty(${getname(param(1))}, [${pp.join(', ')}], false);`);
					js.push(`${idnt} }`);

					moveIdnt(-1);
					js.push(`${idnt} }`);
					if (needFastCheck()) {
						moveIdnt(-1);
						js.push(`${idnt} }`);
					}

				}
					break;
				case Bytecode.APPLYTYPE: {
					const pp = [];

					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					js.push(`${idnt} ${stackF(param(0))} = sec.applyType(${stackF(param(0))}, [${pp.join(', ')}]);`);
				}
					break;

				case Bytecode.FINDPROPSTRICT: {
					const mn = abc.getMultiname(param(0));
					js.push(`${idnt} // ${mn}`);

					if (USE_OPT(lexGen) && lexGen.test(mn)) {
						js.push(`${idnt} /* GenerateLexImports */`);
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stackN} = ${lexGen.getPropStrictAlias(mn,<any>{ nameAlias: getname(param(0)) })};`);

						if (USE_OPT(fastCall)) {
							const mangled = (lexGen.getGenerator(mn) instanceof TopLevelLex);
							fastCall.mark(stackN, i, mangled, mn);
						}
						break;
					}

					js.push(`${idnt} ${stackN} = ${scope}.findScopeProperty(${getname(param(0))}, true, false);`);
					break;
				}
				case Bytecode.FINDPROPERTY:
					js.push(`${idnt} // ${abc.getMultiname(param(0))}`);
					js.push(`${idnt} ${stackN} = ${scope}.findScopeProperty(${getname(param(0))}, false, false);`);
					break;
				case Bytecode.NEWFUNCTION:
					js.push(`${idnt} // ${abc.getMethodInfo(param(0))}`);
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stackN} = sec.createFunction(context.abc.getMethodInfo(${param(0)}), ${scope}, true);`);
					break;
				case Bytecode.NEWCLASS:
					js.push(`${idnt} // ${abc.classes[param(0)]}`);
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stack0} = sec.createClass(context.abc.classes[${param(0)}], ${stack0}, ${scope});`);
					break;

				case Bytecode.GETDESCENDANTS:
				{
					const mn = abc.getMultiname(param(0));
					js.push(`${idnt} // ${mn}`);

					if (mn.isRuntimeName()) {
						const runtime = mn.isRuntimeName() && mn.isRuntimeNamespace();
						const target = runtime ? stack2 : stack1;

						js.push(`${idnt} {`);
						moveIdnt(1);

						if (runtime) {
							// eslint-disable-next-line max-len
							js.push(`${idnt} const rn = context.runtimename(${getname(param(0))}, ${stack0}, ${stack1});`);
						} else {
							js.push(`${idnt} const rn = context.runtimename(${getname(param(0))}, ${stack0});`);
						}

						js.push(`${idnt} ${target} = ${target}.descendants(rn);`);

						moveIdnt(-1);
						js.push(`${idnt}}`);
						break;

					} else {
						js.push(`${idnt} ${stack0} = ${stack0}.descendants(${getname(param(0))});`);
					}

					break;
				}
				case Bytecode.NEWARRAY: {
					const pp = [];

					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					js.push(`${idnt} ${stackF(param(0) - 1)} = sec.AXArray.axBox([${pp.join(', ')}]);`);

					break;
				}
				case Bytecode.NEWOBJECT:
					js.push(`${idnt} temp = Object.create(sec.AXObject.tPrototype);`);

					for (let j: number = 1; j <= param(0); j++) {
						// eslint-disable-next-line max-len
						js.push(`${idnt} temp.axSetPublicProperty(${stackF(2 * param(0) - 2 * j + 1)}, ${stackF(2 * param(0) - 2 * j)});`);
					}

					js.push(`${idnt} ${stackF(2 * param(0) - 1)} = temp;`);
					js.push(`${idnt} temp = undefined;`);

					break;
				case Bytecode.NEWACTIVATION:
					js.push(`${idnt} ${stackN} = sec.createActivation(context.mi, ${scope});`);
					break;
				case Bytecode.NEWCATCH:
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stackN} = sec.createCatch(context.mi.getBody().catchBlocks[${param(0)}], ${scope});`);
					break;
				case Bytecode.CONSTRUCTSUPER: {
					const pp = [];

					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					js.push(`${idnt} context.savedScope.superConstructor.call(${stackF(param(0))}, ${pp.join(', ')});`);
				}
					break;
				case Bytecode.CALLSUPER: {
					const pp = [];

					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stackF(param(0))} = sec.box(${stackF(param(0))}).axCallSuper(${getname(param(1))}, context.savedScope, [${pp.join(', ')}]);`);
				}
					break;
				case Bytecode.CALLSUPER_DYN: {
					const pp = [];

					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					const mn = abc.getMultiname(param(1));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stackF(param(0) + 2)} = sec.box(${stackF(param(0) + 2)}).axGetSuper(context.runtimename(${getname(param(1))}, ${stackF(param(0))}, ${stackF(param(0) + 1)}), context.savedScope, [${pp.join(', ')}]);`);
					} else {
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stackF(param(0) + 1)} = sec.box(${stackF(param(0) + 1)}).axGetSuper(context.runtimename(${getname(param(1))}, ${stackF(param(0))}), context.savedScope, [${pp.join(', ')}]);`);
					}
				}
					break;
				case Bytecode.CALLSUPERVOID: {
					const pp = [];

					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					// eslint-disable-next-line max-len
					js.push(`${idnt} sec.box(${stackF(param(0))}).axCallSuper(${getname(param(1))}, context.savedScope, [${pp.join(', ')}]);`);
				}
					break;
				case Bytecode.CONSTRUCTPROP: {
					const pp = [];

					for (let j: number = 1; j <= param(0); j++)
						pp.push(stackF(param(0) - j));

					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stackF(param(0))} = context.constructprop(${getname(param(1))}, ${stackF(param(0))}, [${pp.join(', ')}]);`);

					USE_OPT(fastCall) && fastCall.kill(stackF(param(0)));
				}
					break;
				case Bytecode.GETPROPERTY: {
					const mn = abc.getMultiname(param(0));
					let isSafe = false;

					if (USE_OPT(blockSaver) && blockSaver.needSafe(stack0)) {
						isSafe = true;

						js.push(`${idnt} ${blockSaver.beginSafeBlock(stack0)}`);

						moveIdnt(1);
					}
					{
						let d: ICallEntry;
						if (USE_OPT(fastCall) && (d = fastCall.sureThatFast(stack0, mn.name))) {
							const n = d.isMangled ? Multiname.getPublicMangledName(mn.name) : mn.name;
							fastCall.kill(stack0);

							js.push(`${idnt} /* We sure that this safe call */ `);
							js.push(`${idnt} ${stack0} = ${stack0}['${n}'];`);

							break;
						}
					}

					js.push(`${idnt} // ${mn}`);

					if (needFastCheck()) {
						js.push(`${idnt} if (!${emitIsAX(stack0)}) {`);
						js.push(`${idnt}     ${stack0} = ${stack0}['${mn.name}'];`);
						js.push(`${idnt} } else {`);

						moveIdnt(1);
					}

					js.push(`${idnt} temp = ${stack0}[AX_CLASS_SYMBOL] ? ${stack0} : sec.box(${stack0});`);
					js.push(`${idnt} ${stack0} = temp['$Bg${mn.name}'];`);
					js.push(`${idnt} if (${stack0} === undefined || typeof ${stack0} === 'function') {`);
					js.push(`${idnt}     ${stack0} = temp.axGetProperty(${getname(param(0))});`);
					js.push(`${idnt} }`);

					if (needFastCheck()) {
						moveIdnt(-1);
						js.push(`${idnt} }`);
					}

					if (isSafe) {
						moveIdnt(-1);
						js.push(`${idnt} ${blockSaver.endSafeBlock('undefined')}`);
					}

					break;
				}
				case Bytecode.GETPROPERTY_DYN: {
					const mn = abc.getMultiname(param(0));

					if (USE_OPT(blockSaver) && blockSaver.markToSafe(mn)) {
						js.push(`${idnt} /* Mark lookup to safe call, ${blockSaver.constructor.name} */`);
					}

					const runtime = mn.isRuntimeName() && mn.isRuntimeNamespace();
					const target = runtime ? stack2 : stack1;

					js.push(`${idnt} // ${mn}`);
					js.push(`${idnt} {`);
					moveIdnt(1);

					if (runtime) {
						js.push(`${idnt} const rm = context.runtimename(${getname(param(0))}, ${stack0}, ${stack1});`);
					} else {
						js.push(`${idnt} const rm = context.runtimename(${getname(param(0))}, ${stack0});`);
					}
					js.push(`${idnt} const b_obj = ${target}[AX_CLASS_SYMBOL] ? ${target} : sec.box(${target});\n`);
					js.push(`${idnt} if (typeof rm === 'number') {`);
					js.push(`${idnt}     ${target} = b_obj.axGetNumericProperty(rm);`);
					js.push(`${idnt} } else {`);

					moveIdnt(1);
					js.push(`${idnt} ${target} = b_obj['$Bg' + rm.name];`);
					js.push(`${idnt} if (${target} === undefined || typeof ${target} === 'function') {`);
					js.push(`${idnt}     ${target} = b_obj.axGetProperty(rm);`);
					js.push(`${idnt} }`);

					moveIdnt(-1);
					js.push(`${idnt} }`);

					moveIdnt(-1);
					js.push(`${idnt} }`);

					break;
				}
				case Bytecode.SETPROPERTY: {
					const mn = abc.getMultiname(param(0));
					js.push(`${idnt} // ${mn}`);

					if (needFastCheck()) {
						js.push(`${idnt} if (!${emitIsAX(stack1)}){`);
						js.push(`${idnt}     ${stack1}['${mn.name}'] = ${stack0};`);
						js.push(`${idnt} } else {`);
						moveIdnt(1);
					}

					js.push(`${idnt} context.setproperty(${getname(param(0))}, ${stack0}, ${stack1});`);

					if (needFastCheck()) {
						moveIdnt(-1);
						js.push(`${idnt} }`);
					}
					break;
				}
				case Bytecode.SETPROPERTY_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						// eslint-disable-next-line max-len
						js.push(`${idnt} context.setproperty(context.runtimename(${getname(param(0))}, ${stack1}, ${stack2}), ${stack0}, ${stack3});`);
					} else {
						// eslint-disable-next-line max-len
						js.push(`${idnt} context.setproperty(context.runtimename(${getname(param(0))}, ${stack1}), ${stack0}, ${stack2});`);
					}
					break;
				}
				case Bytecode.DELETEPROPERTY:
					js.push(`${idnt} // ${abc.getMultiname(param(0))}`);
					js.push(`${idnt} ${stack0} = context.deleteproperty(${getname(param(0))}, ${stack0});`);
					break;
				case Bytecode.DELETEPROPERTY_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stack2} = context.deleteproperty(context.runtimename(${getname(param(0))}, ${stack0}, ${stack1}), ${stack2});`);
					} else {
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stack1} = context.deleteproperty(context.runtimename(${getname(param(0))}, ${stack0}), ${stack1});`);
					}
					break;
				}
				case Bytecode.GETSUPER:
					// eslint-disable-next-line max-len
					js.push(`${idnt} ${stack0} = sec.box(${stack0}).axGetSuper(${getname(param(0))}, context.savedScope);`);
					break;
				case Bytecode.GETSUPER_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stack2} = sec.box(${stack2}).axGetSuper(context.runtimename(${getname(param(0))}, ${stack0}, ${stack1}), context.savedScope);`);
					} else {
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stack1} = sec.box(${stack1}).axGetSuper(context.runtimename(${getname(param(0))}, ${stack0}), context.savedScope);`);
					}
					break;
				}
				case Bytecode.SETSUPER:
					// eslint-disable-next-line max-len
					js.push(`${idnt} sec.box(${stack1}).axSetSuper(${getname(param(0))}, context.savedScope, ${stack0});`);
					break;
				case Bytecode.SETSUPER_DYN: {
					const mn = abc.getMultiname(param(0));
					if (mn.isRuntimeName() && mn.isRuntimeNamespace()) {
						// eslint-disable-next-line max-len
						js.push(`${idnt} sec.box(${stack3}).axSetSuper(context.runtimename(${getname(param(0))}, ${stack1}, ${stack2}), context.savedScope, ${stack0});`);
					} else {
						// eslint-disable-next-line max-len
						js.push(`${idnt} sec.box(${stack2}).axSetSuper(context.runtimename(${getname(param(0))}, ${stack1}), context.savedScope, ${stack0});`);
					}
					break;
				}
				case Bytecode.GETLEX: {
					const mn = abc.getMultiname(param(0));

					if (USE_OPT(lexGen) && lexGen.test(mn)) {
						js.push(`${idnt} // ${mn}`);
						js.push(`${idnt} /* GenerateLexImports */`);
						// eslint-disable-next-line max-len
						js.push(`${idnt} ${stackN} = ${lexGen.getLexAlias(mn,<any>{ nameAlias : getname(param(0)) })};`);

						if (fastCall) {
							const mangled = (lexGen.getGenerator(mn) instanceof TopLevelLex);
							fastCall.mark(stackN, i, mangled, mn, true);
						}
					} else {
						js.push(`${idnt} // ${mn}`);
						js.push(`${idnt} temp = ${scope}.findScopeProperty(${getname(param(0))}, true, false);`);
						js.push(`${idnt} ${stackN} = temp['$Bg${mn.name}'];`);
						js.push(`${idnt} if (${stackN} === undefined || typeof ${stackN} === 'function') {`);
						js.push(`${idnt}     ${stackN} = temp.axGetProperty(${getname(param(0))});`);
						js.push(`${idnt} }`);
					}
					break;
				}
				case Bytecode.RETURNVALUE:
					if (METHOD_HOOKS && METHOD_HOOKS[hookMethodPath + '__return']) {
						js.push(`${idnt} /* ATTACH METHOD HOOK */`);
						js.push(`${idnt} context.executeHook(local0, '${hookMethodPath + '__return'}')`);
					}

					// Restict type conversion for boolean.
					if (methodInfo.getTypeName()?.name === 'Boolean') {
						js.push(`${idnt} return !!${stack0};`);
						break;
					}

					js.push(`${idnt} return ${stack0};`);
					break;
				case Bytecode.RETURNVOID:
					if (METHOD_HOOKS && METHOD_HOOKS[hookMethodPath + '__return']) {
						js.push(`${idnt} /* ATTACH METHOD HOOK */`);
						js.push(`${idnt} context.executeHook(local0, '${hookMethodPath + '__return'}')`);
					}

					js.push(`${idnt} return;`);
					break;
				case Bytecode.COERCE: {
					if ((optimise & COMPILER_OPT_FLAGS.SKIP_NULL_COERCE)
						&& (lastZ.name === Bytecode.PUSHNULL
							|| lastZ.name === Bytecode.PUSHUNDEFINED)) {
						js.push(`${idnt} // SKIP_NULL_COERCE`);
						break;
					}

					if (lastZ.name === Bytecode.ASTYPELATE) {
						js.push(`${idnt} // SKIP DOUBLED COERCE AFTER ASTYPELATE`);
						break;
					}

					const mn = abc.getMultiname(param(0));
					// skip coerce for native JS objects
					js.push(`${idnt} if (${emitIsAX(stack0)}) {`);

					if (Settings.COERCE_MODE == COERCE_MODE_ENUM.DEFAULT) {
						// eslint-disable-next-line max-len
						js.push(`${moveIdnt(1)} ${stack0} = ${scope}.getScopeProperty(${getname(param(0))}, true, false).axCoerce(${stack0});`);

					} else {
						// eslint-disable-next-line max-len
						js.push(`${moveIdnt(1)} var _e = ${scope}.getScopeProperty(${getname(param(0))}, true, false);`);

						if (Settings.COERCE_MODE === COERCE_MODE_ENUM.SOFT) {
							// eslint-disable-next-line max-len
							js.push(`${idnt} _e || console.warn('[${methodName}] Coerce Type not found:', ${JSON.stringify(mn.name)})`);
						}

						js.push(`${idnt} ${stack0} = _e ? _e.axCoerce(${stack0}) : ${stack0};`);
					}
					js.push(`${moveIdnt(-1)} }`);

					break;
				}
				case Bytecode.COERCE_A:
					js.push(`${idnt} ;`);
					break;
				case Bytecode.COERCE_S:
					if ((optimise & COMPILER_OPT_FLAGS.SKIP_NULL_COERCE)
						&& (lastZ.name === Bytecode.PUSHNULL
							|| lastZ.name === Bytecode.PUSHUNDEFINED)) {

						js.push(`${idnt} // SKIP_NULL_COERCE`);
						break;
					}
					js.push(`${idnt} ${stack0} = context.axCoerceString(${stack0});`);
					break;

				case Bytecode.ESC_XELEM:
					js.push(`${idnt} ${stack0} = context.escXElem(${stack0});`);
					break;
				case Bytecode.ESC_XATTR:
					js.push(`${idnt} ${stack0} = context.escXAttr(${stack0});`);
					break;

				case Bytecode.CONVERT_I:
					js.push(`${idnt} ${stack0} |= 0;`);
					break;
				case Bytecode.CONVERT_D:
					js.push(`${idnt} ${stack0} = +${stack0};`);
					break;
				case Bytecode.CONVERT_B:
					js.push(`${idnt} ${stack0} = !!${stack0};`);
					break;
				case Bytecode.CONVERT_U:
					js.push(`${idnt} ${stack0} >>>= 0;`);
					break;
				case Bytecode.CONVERT_S:
					js.push(`${idnt} if (typeof ${stack0} !== 'string') ${stack0} = ${stack0} + '';`);
					break;
				case Bytecode.CONVERT_O:
					js.push(`${idnt} ;`);
					break;
				case Bytecode.CHECKFILTER:
					js.push(`${idnt} ${stack0} = context.axCheckFilter(sec, ${stack0});`);
					break;
				case Bytecode.KILL:
					js.push(`${idnt} ${local(param(0))} = undefined;`);
					break;

				default:
					if (!(optimise & COMPILER_OPT_FLAGS.SKIP_DOMAIN_MEM)) {
						switch (z.name) {
							//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#si32()
							case Bytecode.SI8:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} domainMemory.setInt8(${stack0}, ${stack1})`);
								break;
							case Bytecode.SI16:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} domainMemory.setInt16(${stack0}, ${stack1}, true);`);
								break;
							case Bytecode.SI32:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} domainMemory.setInt32(${stack0}, ${stack1}, true);`);
								break;
							case Bytecode.SF32:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} domainMemory.setFloat32(${stack0}, ${stack1}, true);`);
								break;
							case Bytecode.SF64:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} domainMemory.setFloat64(${stack0}, ${stack1}, true);`);
								break;

							//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#li32()
							case Bytecode.LI8:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} ${stack0} = domainMemory.getInt8(${stack0})`);
								break;
							case Bytecode.LI16:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} ${stack0} = getInt16(${stack0}, true);`);
								break;
							case Bytecode.LI32:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} ${stack0} = domainMemory.getInt32(${stack0}, true);`);
								break;
							case Bytecode.LF32:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} ${stack0} = domainMemory.getFloat32(${stack0}, true);`);
								break;
							case Bytecode.LF64:
								js.push(`${idnt} domainMemory = domainMemory || context.domainMemory;`);
								js.push(`${idnt} ${stack0} = domainMemory.getFloat64(${stack0}, true);`);
								break;
						}
					}

					if ((z.name <= Bytecode.LI8 && z.name >= Bytecode.SF64)) {
						js.push(`${idnt} //unknown instruction ${BytecodeName[q[i].name]}`);
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

		currentCatchBlocks = catchEnd ? catchEnd[z.position] : null;
		if (currentCatchBlocks) {
			const lastCatchBlocks = openTryCatchBlockGroups.pop();
			if (lastCatchBlocks) {
				moveIdnt(-1);

				js.push(`${idnt}}`);
				createCatchConditions(lastCatchBlocks);
			}

		}
	}
	if (openTryCatchBlockGroups.length > 0) {
		const lastCatchBlocks = openTryCatchBlockGroups.pop();
		if (lastCatchBlocks) {
			moveIdnt(-1);

			js.push(`${idnt}}`);
			createCatchConditions(lastCatchBlocks);
		}
	}

	if (genBrancher) {
		// close switch
		js.push(`${moveIdnt(-1)} }`);
		// close while
		js.push(`${moveIdnt(-1)} }`);
	}

	js.push(`${moveIdnt(-1)} }`);

	moveIdnt(-1);

	const locals = [];

	for (const l of optionalLocalVars) {
		if (!l) {
			continue;
		}

		if (l.die) {
			locals.push(`        // local${l.index} is assigned before read, skip init`);
		}
		// todo: this is not 100% correct yet:
		locals.push(`        let local${l.index} = undefined`);
		if (!(optimise & COMPILER_OPT_FLAGS.USE_ES_PARAMS)) {
			if (l.index == params.length + 1 && !l.die) {
				// eslint-disable-next-line max-len
				locals.push(`    if(arguments && arguments.length) { local${l.index} = context.sec.createArrayUnsafe(Array.from(arguments).slice(${params.length})); }`);
				locals.push(`    else { local${l.index} = context.emptyArray; }`);
			}
		}
	}

	js0[LOCALS_POS] = locals.join('\n');

	const header = ['const AX_CLASS_SYMBOL = context.AX_CLASS_SYMBOL;'];

	if (USE_OPT(lexGen)) {
		header.push(lexGen.genHeader(idnt));
	}

	const w =
		scriptHeader +
		header.join('\n') +
		js0.join('\n') + '\n' +
		js.join('\n');

	const hasError = w.indexOf(underrun) > -1;

	const compiled = generateFunc(w, fullPath);

	let underrunLine = -1;

	if (hasError) {
		underrunLine = w.split('\n').findIndex(v => v.indexOf(underrun) >= 0) + 3;
	}

	// reset lexer
	USE_OPT(lexGen) && lexGen.reset();

	// reset saver
	USE_OPT(blockSaver) && blockSaver.reset();

	Stat.end();

	let errorMessage = null;
	if (hasError) {
		errorMessage = {
			message:`STACK UNDERRUN at http://jit/${path}.js:${underrunLine}`,
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

	call(value: AXCallable, obj: ASObject, pp: any[]): any {
		validateCall(this.sec, value, pp.length);
		return value.axApply(obj, pp);
	}

	getdefinitionbyname(scope: Scope, _: any, pp: any[]): AXClass {
		const info = (<ScriptInfo>(<any>scope.global.object).scriptInfo);
		return info.abc.env.app.getClass(Multiname.FromSimpleName(pp[0]));
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
			throw new Error(
				// eslint-disable-next-line max-len
				`[AVM2] Unexpected property assignment: ${typeof obj}[${JSON.stringify(mn?.name)}] = ${value?.toString()}`
			);
		}
		// unsafe SET into plain Object
		if (!obj[IS_AX_CLASS]) {
			obj[mn.name] = value;
			return;
		}

		if (typeof mn === 'number') {
			return obj.axSetNumericProperty(mn, value);
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

		obj.axSetProperty(mn, value, <any>Bytecode.INITPROPERTY);
	}

	deleteproperty(name: string | number | Multiname, obj: AXObject) {
		const b = this.sec.box(obj);

		if (typeof name === 'number' || typeof name === 'string')
			return delete b[name];

		return b.axDeleteProperty(name);
	}

	construct(obj: AXClass, pp: any[]): AXObject {
		const mn = obj.classInfo.instanceInfo.getName();

		const r = extClassContructor(mn.name, pp);

		if (r != null)
			return r;

		// if (mn.name.indexOf("b2") >= 0)
		//     console.log("*B2: " + mn.name)

		validateConstruct(this.sec, obj, pp.length);
		return obj.axConstruct(pp);
	}

	constructprop(mn: Multiname, obj: AXClass, pp: any[]) {
		const r = extClassContructor(mn, pp);

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

	runtimename(mn: Multiname, stack0: Multiname & ASClass | string , stack1: string): Multiname {
		this.rn.resolved = {};
		this.rn.script = null;
		this.rn.numeric = false;
		this.rn.id = mn.id;
		this.rn.kind = mn.kind;

		if (mn.isRuntimeName()) {
			let name = <any>stack0;
			// Unwrap content script-created AXQName instances.
			if (name && name.axClass && name.axClass === name.sec.AXQName) {
				name = name.name;
				release || assert(name instanceof Multiname);
				this.rn.kind = mn.isAttribute() ? CONSTANT.RTQNameLA : CONSTANT.RTQNameL;
				this.rn.id = name.id;
				this.rn.name = name.name;
				this.rn.namespaces = name.namespaces;
				return this.rn;
			}

			// appriory number
			if (typeof name === 'number') {
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
			stack1 = <string>stack0;
		}
		if (mn.isRuntimeNamespace()) {
			let ns = <any> stack1;
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
