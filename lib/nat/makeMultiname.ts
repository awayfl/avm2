import { Namespace } from '../abc/lazy/Namespace';
import { Multiname } from '../abc/lazy/Multiname';
import { CONSTANT } from '../abc/lazy/CONSTANT';

export function makeMultiname(v: string | number, namespace?: Namespace) {
	const rn = new Multiname(null, 0, CONSTANT.RTQNameL, [], null);

	rn.set(v, namespace || Namespace.PUBLIC);

	return rn;
}
