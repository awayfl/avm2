import { ExceptionInfo } from './../../abc/lazy/ExceptionInfo';
import { CompilerState } from './../CompilerState';
import { emitInlineMultiname } from './emitInlineMultiname';

export function emitOpenCatchConditions (state: CompilerState, catchBlocks: ExceptionInfo[]) {
	// catch push Error on stack top
	state.popThisAlias('stack0');
	state.emitBeginMain('catch(e) {');

	state.emitMain('// in case this is a error coming from stack0.__fast when stack0 is undefined,');
	state.emitMain('// we convert it to a ASError, so that avm2 can still catch it');
	state.emitMain('if (e instanceof TypeError) {');
	state.emitMain('     var _e = context.sec.createError("TypeError", {code:1065, message:e.message})');
	state.emitMain('     _e.source = e; e = _e;');
	state.emitMain('}');
	state.emitMain('stack0 = e;');

	let lastCatchItem = '';
	for (let i = 0; i < catchBlocks.length; i++) {
		const typeName = catchBlocks[i].getType();
		if (!typeName) {
			lastCatchItem = `{ p = ${catchBlocks[i].target}; continue; };`;
			continue;
		} else {
			/*
			let n = names.indexOf(typeName);
			if (n < 0) {
				n = names.length;
				names.push(typeName);
				js0.push(`    let name${n} = context.names[${n}];`);
			}*/

			const index = state.getMultinameIndex(typeName);

			// eslint-disable-next-line max-len
			state.emitMain(`const errorClass$${i} = context.sec.application.getClass(${emitInlineMultiname(state, index)});`);
			state.emitMain(`if(errorClass$${i} && errorClass$${i}.axIsType(e))`);
			state.emitMain(`     { p = ${catchBlocks[i].target}; continue; };`);
		}
	}
	if (lastCatchItem)
		state.emitMain(lastCatchItem);

	// if error was not catched by now, we throw it
	state.emitMain('throw e;');
	state.emitEndMain();
}

//	reopen all try-catch blocks. used when entering a new case-block
export function emitOpenTryCatch(state: CompilerState, _group: ExceptionInfo[]) {
	state.emitBeginMain('try {');
}

export function emitCloseTryCatch (state: CompilerState, group: ExceptionInfo[]) {
	state.emitEndMain();
	emitOpenCatchConditions(state, group);
}
