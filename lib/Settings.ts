export interface IAVM2Settings {
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
	HTTP_STRING: 'http://'
};