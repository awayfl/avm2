import { Bytecode } from '../../Bytecode';
import { CompilerState } from '../CompilerState';
import { emitInlineStack } from './emitInlineVars';

export function emitDomainMemOppcodes(state: CompilerState) {
	const z = state.currentOppcode;
	const stack0 = emitInlineStack(state, 0);
	const stack1 = emitInlineStack(state, 1);

	state.emitMain('domainMemory = domainMemory || context.domainMemory;');

	switch (z.name) {
		//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#si32()
		case Bytecode.SI8:
			state.emitMain(`domainMemory.setInt8(${stack0}, ${stack1})`);
			break;
		case Bytecode.SI16:
			state.emitMain(`domainMemory.setInt16(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SI32:
			state.emitMain(`domainMemory.setInt32(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SF32:
			state.emitMain(`domainMemory.setFloat32(${stack0}, ${stack1}, true);`);
			break;
		case Bytecode.SF64:
			state.emitMain(`domainMemory.setFloat64(${stack0}, ${stack1}, true);`);
			break;

		//http://docs.redtamarin.com/0.4.1T124/avm2/intrinsics/memory/package.html#li32()
		case Bytecode.LI8:
			state.emitMain(`${stack0} = domainMemory.getInt8(${stack0})`);
			break;
		case Bytecode.LI16:
			state.emitMain(`${stack0} = getInt16(${stack0}, true);`);
			break;
		case Bytecode.LI32:
			state.emitMain(`${stack0} = domainMemory.getInt32(${stack0}, true);`);
			break;
		case Bytecode.LF32:
			state.emitMain(`${stack0} = domainMemory.getFloat32(${stack0}, true);`);
			break;
		case Bytecode.LF64:
			state.emitMain(`${stack0} = domainMemory.getFloat64(${stack0}, true);`);
			break;
	}
}