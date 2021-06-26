export interface IAVM2Settings {
	NO_CHECK_FASTCALL_FOR_THIS: boolean;
	NO_CHECK_BOXED_THIS: boolean;
	NO_HOIST_MULTINAME: boolean;
	CHEK_TRAIT_GET_CALL: boolean;
	CHEK_TRAIT_SET: boolean;
	CHEK_SUPER_TRAITS: boolean;
	OPTIMISE_ON_IR: boolean;
	ENABLE_DEBUG: boolean;
	PRINT_BYTE_INSTRUCTION: boolean;
	EMULATE_LOOKBEHIND: boolean;
	ENABLE_LOOP_QUARD: boolean;
	LOOP_GUARD_MAX_LOOPS: number;
	LOOP_GUARD_MIN_BRANCHES: number;
	COERCE_MODE: COERCE_MODE_ENUM;
	CHECK_OBFUSCATED_NAME: boolean;
	NO_FALL_TO_INT: boolean;
	NO_PROPAGATE_SCOPES_FOR_TRY: boolean;
	HTTP_STRING: string;
	EMIT_REAL_THIS: boolean;
	UNSAFE_PROPOGATE_THIS: boolean;
	UNSAFE_INLINE_CONST: boolean;
	FOLLOW_AS3_BUG: boolean;
	USE_WEAK_REF: boolean;
}

export const enum COERCE_MODE_ENUM {
	DEFAULT = 'default', // strict coerce, will crash if type not found
	SOFT = 'soft', // warning when coerce type not found, and return same object
	SOFT_SILENT = 'soft_silent' // return same object without warnings
}

export const Settings: IAVM2Settings = {
	/**
	 * @description Enable debug mode, will throw error descriptions
	 */
	ENABLE_DEBUG: true,

	/**
	 * @description Printing a instruction code that was compiled to JS
	 */
	PRINT_BYTE_INSTRUCTION: false,

	/**
	 * @description Use a XRegExp when RegExp require a lookbehinde pattern on Safari
	 */
	EMULATE_LOOKBEHIND: true,

	/**
	 * @description Guard to avoid infinity loops, throw exception
	 */
	ENABLE_LOOP_QUARD: false,
	/**
	 * @description  How many branching jumps required for enable guarding except Exceptions
	 */
	LOOP_GUARD_MIN_BRANCHES: 3,
	LOOP_GUARD_MAX_LOOPS: 100_000,

	/**
	 * @description Restirct coerce bechaviour
	 */
	COERCE_MODE: COERCE_MODE_ENUM.SOFT,

	/**
	 * @description Validate names in compile process and fall to interpret when it invalid for compilation
	 */
	CHECK_OBFUSCATED_NAME: false,

	/**
	 * @description Disallow falling to interpret mode
	 */
	NO_FALL_TO_INT: true,

	/**
	 * @description Disable scope proporgardition for try-catch blocks
	 */
	NO_PROPAGATE_SCOPES_FOR_TRY: true,

	/**
	 * @description switch between http and https for jit files
	 */
	HTTP_STRING: 'http://',

	/**
	 * @description Use `this` when poosible use real context without store it as local0, this should help debug
	 */
	EMIT_REAL_THIS: true,

	/**
	 * @description Try propagade `this` in instruction set, super unsafe. Disable it when any errors is exist
	 */
	UNSAFE_PROPOGATE_THIS: true,

	/**
	 * @description use real constant values for r-values instead of stack-aliases
	 */
	UNSAFE_INLINE_CONST: true,

	/**
	 * @description Allow optimisation on Analyzer phase
	 */
	OPTIMISE_ON_IR: true,

	/**
	 * @description No hoist multiname (no emit name1 in generated script), this can save a lot of codelines
	 */
	NO_HOIST_MULTINAME: true,
	/**
	 * @description Disable use fast path call and property get/set when used external lib on `this`,
	 * because we not emit unwrapped code for it, and fast check will fail for it
	 * this remove 3 lines for call/get/set
	 */
	NO_CHECK_FASTCALL_FOR_THIS: true,
	/**
	 * @description Not require check boxing for this, it already always should be boxed to AVM object,
	 */
	NO_CHECK_BOXED_THIS: true,
	/**
	 * @description Check trait type of property for generation FAST operation for getProperty and call property,
	 * avoid generate redundant if-block
	 */
	CHEK_TRAIT_GET_CALL: true,
	/**
	 * @description Check trait type of property for generation FAST operation for setProperty, avoid redundant if-block
	 * @todo Atm we not call coerse, result can be unstable
	 */
	CHEK_TRAIT_SET: true,
	/**
	 * @description Check super class traits when field was extended, this can be unstable and has performance hit
	 */
	CHEK_SUPER_TRAITS: true,
	/**
	 * @description when there are a string with ending character as 0, coerce in FP return valid number instead NaN
	 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=564839
	 */
	FOLLOW_AS3_BUG: false,
	/**
	 * @description Use `WeakRef` for holding a Orphan in OrphanaManager on supported platforms
	 */
	USE_WEAK_REF: true
};