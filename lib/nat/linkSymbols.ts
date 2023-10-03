import { Traits } from '../abc/lazy/Traits';
import { NamespaceType } from '../abc/lazy/NamespaceType';
import { assert } from '@awayjs/graphics';
import { release, notImplemented, hasOwnGetter } from '@awayfl/swf-loader';
import { containsSymbol } from './containsSymbol';

export function linkSymbols(symbols: string [], traits: Traits, object) {
	for (let i = 0; i < traits.traits.length; i++) {
		const trait = traits.traits[i];
		const multiname = trait.multiname;
		const name = multiname.name;
		const namespace = multiname.namespace;
		if (!containsSymbol(symbols, name)) {
			continue;
		}
		release || assert (namespace.type !== NamespaceType.Private, 'Why are you linking against private members?');
		if (trait.isConst()) {
			release || release || notImplemented('Don\'t link against const traits.');
			return;
		}
		const qn = multiname.getMangledName();
		if (trait.isSlot()) {
			Object.defineProperty(object, name, {
				get: <() => any> new Function('', 'return this.' + qn +
                                            '//# sourceURL=get-' + qn + '.as'),
				set: <(any) => void> new Function('v', 'this.' + qn + ' = v;' +
                                                '//# sourceURL=set-' + qn + '.as')
			});
		} else if (trait.isGetter()) {
			release || assert (hasOwnGetter(object, qn), 'There should be an getter method for this symbol.');
			Object.defineProperty(object, name, {
				get: <() => any> new Function('', 'return this.' + qn +
                                            '//# sourceURL=get-' + qn + '.as')
			});
		} else {
			notImplemented(trait.toString());
		}
	}
}
