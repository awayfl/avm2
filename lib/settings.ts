export interface IAVM2Settings {
	ENABLE_DEBUG: boolean;
	PRINT_BYTE_INSTRUCTION: boolean;
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
};