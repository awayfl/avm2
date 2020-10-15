import { release } from '@awayfl/swf-loader';
import { assert } from '@awayjs/graphics';
import { nativeFunctions } from './nativeFunctions';
import { Natives } from './Natives';

/**
 * Searches for natives using a string path "a.b.c...".
 */
export function getNative(path: string): Function {
	const chain = path.split('.');
	let v: any = Natives;
	for (let i = 0, j = chain.length; i < j; i++) {
		v = v && v[chain[i]];
	}
	if (!v) {
		v = nativeFunctions[path];
	}
	release || assert(v, 'getNative(' + path + ') not found.');
	return v;
}