import { CONSTANT } from '../../abc/lazy/CONSTANT';
import { MethodInfo } from '../../abc/lazy/MethodInfo';
import { IFunctionAnnotation } from './emitAnnotation';

export function emitAnnotationOld(methodInfo: MethodInfo, moveIdnt): IFunctionAnnotation {
	const methodName = methodInfo.meta.name;
	const params = methodInfo.parameters;
	const js0 = [];
	const idnt = moveIdnt(1);

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

	return {
		annotation: js0.join('\n'),
		paramsShift: 0
	};
}