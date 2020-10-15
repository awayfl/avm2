import { addPrototypeFunctionAlias } from './addPrototypeFunctionAlias';
import { ASObject } from './ASObject';

export class ASBoolean extends ASObject {
	static classInitializer() {
		const proto: any = this.dPrototype;
		const asProto: any = ASBoolean.prototype;
		addPrototypeFunctionAlias(proto, '$BgtoString', asProto.toString);
		addPrototypeFunctionAlias(proto, '$BgvalueOf', asProto.valueOf);
	}

	value: boolean;

	toString() {
		return this.value.toString();
	}

	valueOf() {
		return this.value.valueOf();
	}
}
