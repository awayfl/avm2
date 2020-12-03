export interface IAVM2Settings {
	ENABLE_DEBUG: boolean;
	PRINT_BYTE_INSTRUCTION: boolean;
	EMULATE_LOOKBEHIND: boolean;
	ENABLE_LOOP_QUARD: boolean;
	LOOP_QUARD_MAX_LOOPS: number;
	LOOP_QUARD_MIN_BRANCHES: number;
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
	ENABLE_LOOP_QUARD: true,
	/**
	 * @description  How many branching jumps required for enable guarding except Exceptions
	 */
	LOOP_QUARD_MIN_BRANCHES: 3,
	LOOP_QUARD_MAX_LOOPS: 10000,
};