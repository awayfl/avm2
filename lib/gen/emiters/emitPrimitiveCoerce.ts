import { Multiname } from '../../abc/lazy/Multiname';
import { Settings } from '../../Settings';
import { CompilerState } from '../CompilerState';
import { emitInlineStack } from './emitInlineVars';
import { axCoerceNumber } from '../../run/axCoerceNumber';
import { axCoerceInt } from '../../run/axCoerceInt';
import { axCoerceUint } from '../../run/axCoerceUint';
import { axCoerceBoolean } from '../../run/axCoerceBoolean';
import { axCoerceString } from '../../run/axCoerceString';

const typeToCoerceMapping: Record<string, (x: string) => string > = {

	['Number']: (x) => {
		if (Settings.FOLLOW_AS3_BUG) {
			return `sec.AXNumber.axCoerce(${x})`;
		}

		return `(+${x})`;
	},
	['int']: (x) => {
		if (Settings.FOLLOW_AS3_BUG) {
			return `sec.AXNumber.axCoerce(${x}) | 0`;
		}

		return `(${x}|0)`;
	},

	['uint']: (x) => `(${x}>>>0)`,
	['Boolean']: (x) => `(!!${x})`,
	['String']: (x: string) => `(${x}==null?null:''+ ${x})`,
};

const staticCoerceMapping: Record<string, (v: any) => any> = {
	['Number']: axCoerceNumber,
	['int']: axCoerceInt,
	['uint']: axCoerceUint,
	['Boolean']: axCoerceBoolean,
	['String']: axCoerceString,
};

export function isPrimitiveType(type: Multiname): boolean {
	return type && type.name && (type.name in staticCoerceMapping);
}

/**
 * Emit coercion mapping for primitive values: arguments, returns, fast coercion
 * @param state
 * @param stackIndexOrName index - when it it stack, name - when is local or not stack value
 * @param type
 * @param inline Inline coerce return name without coersion instead of null
 */
export function emitPrimitiveCoerce (
	state: CompilerState,
	stackIndexOrName: number | string,
	type: Multiname,
	inline = false
): string | null {

	if (!isPrimitiveType(type)) {
		// no coerce if not required
		if (!inline) {
			return null;
		}

		return typeof  stackIndexOrName === 'string'
			? stackIndexOrName
			: emitInlineStack(state, stackIndexOrName);
	}

	if (typeof stackIndexOrName === 'string') {
		return typeToCoerceMapping[type.name](stackIndexOrName);
	}

	const constAlias = state.getConstAliasMeta(stackIndexOrName);

	// coerce inline for const, const will be transformed to specific type in compiler state
	if (constAlias && constAlias.isConst) {
		const res = staticCoerceMapping[type.name](constAlias.value);

		if (typeof res === 'string')
			return JSON.stringify(res);
		return '' + res;
	}

	return typeToCoerceMapping[type.name](emitInlineStack(state, stackIndexOrName));
}
