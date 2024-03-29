import { CONSTANT } from '../../abc/lazy/CONSTANT';
import { CompilerState } from '../CompilerState';
import { emitInlineLocal } from './emitInlineVars';
import { Multiname } from '../../abc/lazy/Multiname';
import { emitPrimitiveCoerce } from './emitPrimitiveCoerce';
export interface IFunctionAnnotation {
	annotation: string,
	paramsShift: number
}

export function emitAnnotation (state: CompilerState): IFunctionAnnotation  {
	const methodInfo = state.methodInfo;
	const params = state.methodInfo.parameters;
	const abc = state.methodInfo.abc;
	const methodName = state.methodInfo.meta.name;

	let paramsShift = 0;

	const args: {name: string, value?: any, type?: Multiname}[] = [];
	const js0 = [];

	for (let i = 0; i < params.length; i++) {
		const p = params[i];
		const arg = { name: emitInlineLocal(state, i + 1), value: null, type: null };

		if (p.hasOptionalValue()) {
			switch (p.optionalValueKind) {
				case CONSTANT.Utf8:
					arg.value = `${JSON.stringify(abc.getString(p.optionalValueIndex))}`;
					break;
				default:
					arg.value = `${p.getOptionalValue()}`;
			}
		}

		arg.type = p.typeName;
		args[i] = arg;
	}

	if (methodInfo.needsRest()) {
		args.push({ name: '...args' });
	}

	const argsFilled = args
		.map((e) => {
			return e.value
				? `${e.name} /* ${e.type ? e.type.name : '*'} */ = ${e.value}`
				: `${e.name} /* ${e.type ? e.type.name : '*'} */`;
		})
		.join(', ');

	const mname =  methodName.replace(/([^a-z0-9]+)/gi, '_');

	js0.push(`${state.indent}return function compiled_${mname}(${argsFilled}) {`);

	state.moveIndent(1);

	const thisAlias = emitInlineLocal(state, 0);
	if (thisAlias !== 'this') {
		if (state.isPossibleGlobalThis) {
			// eslint-disable-next-line max-len
			js0.push(`${state.indent}let ${thisAlias} = this === context.jsGlobal ? context.savedScope.global.object : this;`);
		} else {
			js0.push(`${state.indent}let ${thisAlias} = this;`);
		}
	} else {
		js0.push(`${state.indent}// Possible use a real "this"`);
	}

	for (const a of args) {
		const argCoerce = emitPrimitiveCoerce(state, a.name, a.type, false);

		if (argCoerce) {
			js0.push(`${state.indent}/* Force ${a.type.name} coerce */`);
			js0.push(`${state.indent}${a.name} = ${argCoerce};`);
		}
	}

	if (methodInfo.needsRest()) {
		// eslint-disable-next-line max-len
		js0.push(`${state.indent}let ${emitInlineLocal(state, params.length + 1)} = context.sec.createArrayUnsafe(args);`);
		paramsShift += 1;
	}

	if (methodInfo.needsArguments()) {
		// eslint-disable-next-line max-len
		js0.push(`${state.indent}let ${emitInlineLocal(state, params.length + 1)} = context.sec.createArrayUnsafe(Array.from(arguments));`);
		paramsShift += 1;
	}

	return {
		annotation : js0.join('\n'),
		paramsShift: paramsShift
	};
}