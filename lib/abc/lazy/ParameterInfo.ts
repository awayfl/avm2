import { CONSTANT } from './CONSTANT';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';

export class ParameterInfo {
	/**
	 * Don't rely on the name being correct.
	 */
	public name: string;
	public optionalValueKind: CONSTANT | number = -1;
	public optionalValueIndex: number = -1;

	constructor(
		public readonly abc: ABCFile,
		public readonly typeName: Multiname,
	) {}

	hasOptionalValue(): boolean {
		return this.optionalValueKind >= 0;
	}

	getOptionalValue(): any {
		return this.abc.getConstant(this.optionalValueKind, this.optionalValueIndex);
	}

	public toString() {
		let str = '';
		if (this.name) {
			str += this.name;
		} else {
			str += '?';
		}
		if (this.typeName) {
			str += ': ' + this.typeName.name;
		}
		if (this.optionalValueKind >= 0) {
			str += ' = ' + this.abc.getConstant(this.optionalValueKind, this.optionalValueIndex);
		}
		return str;
	}
}