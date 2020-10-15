
export function axAsType(x: any): any {
	return ((x && x.__fast__) || this.axIsType(x)) ? x : null;
}