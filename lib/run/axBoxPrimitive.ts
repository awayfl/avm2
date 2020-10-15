
export function axBoxPrimitive(value) {
	const boxed = Object.create(this.tPrototype);
	boxed.value = value;
	return boxed;
}
