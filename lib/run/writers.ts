import { IndentingWriter, dumpLine, release, registerDebugMethod } from '@awayfl/swf-loader';
import { WriterFlags } from './WriterFlags';

const writer = new IndentingWriter(false, function (x) { dumpLine(x); });
export let runtimeWriter = null;
export let executionWriter = null;
export let interpreterWriter = null;

export function sliceArguments(args, offset: number) {
	return Array.prototype.slice.call(args, offset);
}

export function setWriters(flags: WriterFlags, output: IndentingWriter | Function | null = writer) {
	if (typeof (<any>output) === 'function') {
		output = new IndentingWriter(false, output);
	}

	runtimeWriter = (flags & WriterFlags.Runtime) ? output : null;
	executionWriter = (flags & (WriterFlags.Execution | WriterFlags.Interpreter)) ? output : null;
	interpreterWriter = (flags & WriterFlags.Interpreter) ? output : null;
}

// export WRITER API for capture AVM2 reports
if (!release) {
	registerDebugMethod(setWriters, {
		name: 'registerWriter',
		description:'Registering a writer function for capturing logs',
		declaration: [{ name:'flags', type: 'string' }, { name: 'func', type:'function' }]
	});
}