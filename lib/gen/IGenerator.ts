export interface IGenerator {
	/**
	 * Generate header (before method anotation) of imports when it exist, or return empty string
	 */
	genHeader(ident: string): string;

	/**
	 * Generate body (after method annotations), return empty string
	 */
	genBody(ident: string): string;

	/**
	 * Run postprocess mutation of generated code
	 */
	genPost(arr: string[]): string[];

	/**
	 * Reset generator
	 */
	reset(): void;
}