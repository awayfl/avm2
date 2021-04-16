import { CONSTANT } from '../../abc/lazy/CONSTANT';
import { TRAIT } from '../../abc/lazy/TRAIT';
import { MethodInfo } from './../../abc/lazy/MethodInfo';

export interface IFunctionAnnotation {
	annotation: string,
	paramsShift: number
}

export function emitAnnotation (methodInfo: MethodInfo, moveIdnt: (a: number) => string): IFunctionAnnotation  {
	const params = methodInfo.parameters;
	const abc = methodInfo.abc;
	const methodName = methodInfo.meta.name;

	let paramsShift = 0;

	// shift function body
	const idnt = moveIdnt(1);

	const args: {name: string, value?: any, type?: string}[] = [];
	const js0 = [];

	for (let i = 0; i < params.length; i++) {
		const p = params[i];
		const arg = { name: 'local' + (i + 1), value: null, type: '' };

		if (p.hasOptionalValue()) {
			switch (p.optionalValueKind) {
				case CONSTANT.Utf8:
					arg.value = `${JSON.stringify(abc.getString(p.optionalValueIndex))}`;
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

	// this for get/set cann't be global
	const kind = methodInfo.trait?.kind;
	if (kind === TRAIT.Setter || kind === TRAIT.Getter) {
		js0.push(`${idnt} let local0 = this;`);
	} else {
		js0.push(`${idnt} let local0 = this === context.jsGlobal ? context.savedScope.global.object : this;`);
	}

	for (const a of args) {
		const name = a.name;
		let argCoerce = '';

		switch (a.type) {
			case 'String':
				// eslint-disable-next-line max-len
				argCoerce = `${name} = (${name} != null && typeof ${name} !== 'string') ? ${name}.toString() : ${name};`;
				break;
			case 'Number':
				argCoerce = `${name} = +${name};`;
				break;
			case 'int':
				argCoerce = `${name} = ${name} | 0;`;
				break;
			default:
				break;
		}

		if (argCoerce) {
			js0.push(`${idnt} /* Force ${a.type} coerce */`);
			js0.push(`${idnt} ${argCoerce}`);
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

	return {
		annotation : js0.join('\n'),
		paramsShift: paramsShift
	};
}