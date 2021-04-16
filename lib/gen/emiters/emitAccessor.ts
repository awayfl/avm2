const VALID_PROP_REG = /^[a-zA-Z$_][a-zA-Z0-9$_]*$/;
export function emitAccessor (obj: string, prop: string): string {
	if (prop && VALID_PROP_REG.test(prop)) {
		return `${obj}.${prop}`;
	}

	return `${obj}[${prop}]`;
}
