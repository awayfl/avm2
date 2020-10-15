
export function axApplyObject(_, args) {
	const x = args[0];
	if (x == null) {
		return Object.create(this.tPrototype);
	}
	return x;
}