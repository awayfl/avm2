import { TraitInfo } from './TraitInfo';
import { release } from '@awayfl/swf-loader';
import { assert } from '@awayjs/graphics';
import { IndentingWriter } from '@awayfl/swf-loader';
import { Multiname } from './Multiname';
import { RuntimeTraits } from './RuntimeTraits';
import { Namespace } from './Namespace';
import { Scope } from '../../run/Scope';
import { RuntimeTraitInfo } from './RuntimeTraitInfo';
import { NamespaceType } from './NamespaceType';
import { createMethodForTrait } from './createMethodForTrait';
import { TRAIT } from './TRAIT';
import { MethodTraitInfo } from './MethodTraitInfo';
import { SlotTraitInfo } from './SlotTraitInfo';
import { ILocalInfo } from './ILocalInfo';

/**
 * The Traits class represents the collection of compile-time traits associated with a type.
 * It's not used for runtime name resolution on instances; instead, the combined traits for
 * a type and all its super types is resolved and translated to an instance of RuntimeTraits.
 */
export class Traits {
	private _multinames: Record<string, TraitInfo>;

	constructor(
		public readonly traits: TraitInfo [],
		global: boolean = false
	) {
		const multinames = global ? (this._multinames = Traits._globalMultinames) : (this._multinames = {});

		for (let i = 0; i < this.traits.length; i++) {
			const trait = this.traits[i];
			const mn: Multiname = trait.multiname;
			multinames[mn.namespaces[0].uri + '.' + mn.name] = trait;
		}
	}

	attachHolder(holder: ILocalInfo) {
		for (let i = 0; i < this.traits.length; i++) {
			release || assert(!this.traits[i].holder);
			this.traits[i].holder = holder;
		}
	}

	trace(writer: IndentingWriter = new IndentingWriter()) {
		this.traits.forEach(x => writer.writeLn(x.toString()));
	}

	private static _globalMultinames: Record<string, TraitInfo> = {}

	public static getGlobalTrait(mn: Multiname): TraitInfo {
		const nm = mn.name;
		let t: TraitInfo;
		for (const ns of mn.namespaces)
			if ((t = Traits._globalMultinames[ns.uri + '.' + nm]))
				return t;

		return null;
	}

	getTrait(mn: Multiname): TraitInfo {
		const nm = mn.name;
		let t: TraitInfo;
		for (const ns of mn.namespaces)
			if ((t = this._multinames[ns.uri + '.' + nm]) && t.holder.traits === this)
				return t;

		return null;
	}

	/**
     * Turns a list of compile-time traits into runtime traits with resolved bindings.
     *
     * Runtime traits are stored in 2-dimensional maps. The outer dimension is keyed on the
     * trait's local name. The inner dimension is a map of mangled namespace names to traits.
     *
     * Lookups are thus O(n) in the number of namespaces present in the query, instead of O(n+m)
     * in the number of traits (n) on the type times the number of namespaces present in the
     * query (m).
     *
     * Negative result note: an implementation with ECMAScript Maps with Namespace objects as
     * keys was tried and found to be much slower than the Object-based one implemented here.
     * Mostly, the difference was in how well accesses are optimized in JS engines, with Maps
     * being new-ish and less well-optimized.
     *
     * Additionally, all protected traits get added to a map with their unqualified name as key.
     * That map is created with the super type's map on its prototype chain. If a type overrides
     * a protected trait, it gets set as that type's value for the unqualified name. Additionally,
     * its name is canonicalized to use the namespace used in the initially introducing type.
     * During name lookup, we first check for a hit in that map and (after verifying that the mn
     * has a correct protected name in its namespaces set) return the most recent trait. That way,
     * all lookups always get the most recent trait, even if they originate from a super class.
     */
	resolveRuntimeTraits(superTraits: RuntimeTraits, protectedNs: Namespace,
		scope: Scope, forceNativeMethods: boolean = false): RuntimeTraits {
		// Resolve traits so that indexOf works out.
		const protectedNsMappings = Object.create(superTraits ? superTraits.protectedNsMappings : null);
		const result = new RuntimeTraits(superTraits, protectedNs, protectedNsMappings);

		// Add all of the child traits, replacing or extending parent traits where necessary.
		for (let i = 0; i < this.traits.length; i++) {
			const trait = this.traits[i];
			const mn = trait.multiname;
			const runtimeTrait = new RuntimeTraitInfo(mn, trait.kind, trait.abc);
			if (mn.namespaces[0].type === NamespaceType.Protected) {
				// Names for protected traits get canonicalized to the name of the type that initially
				// introduces the trait.
				if (result.protectedNsMappings[mn.name]) {
					runtimeTrait.multiname = result.protectedNsMappings[mn.name].multiname;
				}
				result.protectedNsMappings[mn.name] = runtimeTrait;
			}

			const currentTrait = result.addTrait(runtimeTrait);

			switch (trait.kind) {
				case TRAIT.Method:
					runtimeTrait.value = createMethodForTrait(<MethodTraitInfo>trait, scope, forceNativeMethods);
					break;
				case TRAIT.Getter:
					runtimeTrait.get = createMethodForTrait(<MethodTraitInfo>trait, scope, forceNativeMethods);
					if (currentTrait && currentTrait.set) {
						runtimeTrait.set = currentTrait.set;
						runtimeTrait.kind = TRAIT.GetterSetter;
					}
					break;
				case TRAIT.Setter:
					runtimeTrait.set = createMethodForTrait(<MethodTraitInfo>trait, scope, forceNativeMethods);
					if (currentTrait && currentTrait.get) {
						runtimeTrait.get = currentTrait.get;
						runtimeTrait.kind = TRAIT.GetterSetter;
					}
					break;
				case TRAIT.Slot:
				case TRAIT.Const:
				case TRAIT.Class:
					// Only non-const slots need to be writable. Everything else is fixed.
					runtimeTrait.writable = true;
					runtimeTrait.slot = (<SlotTraitInfo>trait).slot;
					runtimeTrait.value = (<SlotTraitInfo>trait).getDefaultValue();
					runtimeTrait.typeName = (<SlotTraitInfo>trait).typeName;
					// TODO: Throw error for const without default.
					result.addSlotTrait(runtimeTrait);
			}
		}
		return result;
	}
}