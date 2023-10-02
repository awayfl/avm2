import { TraitInfo } from '../abc/lazy/TraitInfo';
import { getNativesForTrait } from './getNativesForTrait';
import { hasOwnProperty, release, warning, assertUnreachable } from '@awayfl/swf-loader';
import { assert } from '@awayjs/graphics';

/**
 * Searches for a native property in a list of native holders.
 */
export function getMethodOrAccessorNative(trait: TraitInfo, throwErrors: boolean = true): any {
	const natives = getNativesForTrait(trait, throwErrors);
	const name = trait.multiname.name;
	for (let i = 0; i < natives.length; i++) {
		const native = natives[i];
		let fullName = name;
		// We prefix methods that should not be exported with "native_", check to see
		// if a method exists with that prefix first when looking for native methods.
		if (!hasOwnProperty(native, name) && hasOwnProperty(native, 'native_' + name)) {
			fullName = 'native_' + name;
		}
		if (hasOwnProperty(native, fullName)) {
			var value;
			if (trait.isAccessor()) {
				const pd = Object.getOwnPropertyDescriptor(native, fullName);
				if (trait.isGetter()) {
					value = pd.get;
				} else {
					value = pd.set;
				}
			} else {
				release || assert (trait.isMethod());
				value = native[fullName];
			}
			release || assert (value, 'Method or Accessor property exists but it\'s undefined: ' + trait.holder + ' ' + trait);
			return value;
		}
	}
	warning('No native method for: ' + trait.holder + ' ' + trait + ', make sure you\'ve got the static keyword for static methods.');
	release || assertUnreachable('Cannot find ' + trait + ' in natives.');
	return null;
}