import { MovieClip, FrameScriptManager, DisplayObject, Sprite, DisplayObjectContainer, Timeline } from '@awayjs/scene';
import { AssetBase } from '@awayjs/core';
import { AXClass, IS_AX_CLASS } from './AXClass';
import { Multiname } from '../abc/lazy/Multiname';
import { ASObject } from '../nat/ASObject';
import { RuntimeTraits } from '../abc/lazy/RuntimeTraits';
import { Settings } from '../Settings';

export class ActiveLoaderContext {
	//	ActiveLoaderContext.loaderContext is a hack !
	//	in future the appDom should be provided by the symbol
	public static loaderContext: any;
}

interface IAwayApplicationDomain {
	hasSymbolForClass(className: string): boolean;
	getSymbolDefinition(clasName: string): any;
	getSymbolAdaptee(clasName: string): any;
}

const USE_WEAK = ('WeakRef' in self) && Settings.USE_WEAK_REF;

if (USE_WEAK) {
	console.debug('[OrphanManager] `WeakRef` used for orphans!');
}

// todo: move OrphanManager elsewhere and add strong type
// 	maybe eve solve the orphan-issue in otherway alltogether
export class OrphanManager {

	static orphans: Record<number, WeakRef<DisplayObject> | DisplayObject> = Object.create(null);
	static totalOrphansCount: number = 0;

	static addOrphan(orphan: DisplayObject = null) {
		if (!orphan) {
			return;
		}

		if (!orphan.isAsset ||
			!(
				orphan.isAsset(MovieClip) ||
				orphan.isAsset(Sprite) ||
				orphan.isAsset(DisplayObjectContainer)
			)
		) {
			return;
		}

		if (orphan.id in this.orphans)
			return;

		this.orphans[orphan.id] = USE_WEAK ? new self.WeakRef(orphan) : orphan;
		this.totalOrphansCount++;
	}

	static removeOrphan(orphan: DisplayObject) {
		if (!(orphan.id in this.orphans))
			return;

		this.totalOrphansCount--;
		delete this.orphans[orphan.id];
	}

	static updateOrphans() {

		let orphan: WeakRef<DisplayObject> | DisplayObject;

		for (const key in this.orphans) {
			orphan = this.orphans[key];

			if (USE_WEAK && orphan) {
				orphan = (<WeakRef<DisplayObject>> orphan)?.deref();
			}

			if (orphan) {
				if (!(<DisplayObject> orphan).parent) {
					(<MovieClip>orphan).advanceFrame();
					FrameScriptManager.execute_as3_constructors_recursiv(<MovieClip> orphan);
				} else {
					// delete, orphan has parent
					this.totalOrphansCount--;
					delete this.orphans[key];
				}
			} else {
				console.debug('[OrphanManager] Orphan was deleted by GC:', key);
				this.totalOrphansCount--;
				delete this.orphans[key];
			}
		}
	}
}

function initTraitsForObject (object: ASObject, traits: RuntimeTraits) {
	if (!traits)
		return;
	if (traits.slots) {
		for (let i = 0; i < traits.slots.length; i++) {
			if (traits.slots[i]) {
				object[traits.slots[i].multiname.getMangledName()] =  traits.slots[i].value;
			}
		}
	}

	if (traits.superTraits)
		initTraitsForObject(object, traits.superTraits);

	return object;
}

/**
 * Generic axConstruct method that lives on the AXClass prototype. This just
 * creates an empty object with the right prototype and then calls the
 * instance initializer.
 *
 * TODO: Flatten out the argArray, or create an alternate ax helper to
 * make object construction faster.
 */
export function axConstruct(argArray?: any[]) {
	const _this = this as AXClass;

	const object = Object.create(_this.tPrototype);
	initTraitsForObject(object, _this.tPrototype.traits);

	let symbol = null;
	let timeline = null;
	let classToCheck = _this;

	//  find the AwayJS-timline that should be used for this MC. might be on superclass...
	while (classToCheck && !timeline) {
		symbol = (<any>classToCheck)._symbol;
		if (symbol && symbol.timeline)
			timeline = symbol.timeline;
		classToCheck = classToCheck.superClass;
	}

	const name = _this.superClass?.classInfo?.instanceInfo?.multiname?.name;
	let appDom: IAwayApplicationDomain;

	if (_this.axApplicationDomain && _this.axApplicationDomain.awayApplicationDomain) {
		appDom = _this.axApplicationDomain.awayApplicationDomain;
	} else if (ActiveLoaderContext.loaderContext) {
		appDom = ActiveLoaderContext.loaderContext.applicationDomain;
	}

	const mn =  _this.classInfo.instanceInfo.multiname;
	const instName = mn.name;
	const fullName = mn.uri ? mn.uri + '.' + instName : instName;

	if (timeline) {
		// type MUST BE AS MC, if it was a sprite - mc not will be generated
		const isMovieClip = (<any> this.sec).flash.display.MovieClip.axIsType(object)
						|| (<any> this.sec).flash.display.SimpleButton.axIsType(object);

		if (!isMovieClip) {
			//console.log('Class is not MC:', fullName);
		}
		const adaptee = new MovieClip(timeline, !isMovieClip);

		object.adaptee = adaptee;

		adaptee.reset();
		FrameScriptManager.execute_as3_constructors_recursiv(adaptee);
	}

	if (!timeline && appDom && appDom.hasSymbolForClass(fullName)) {
		const asset: AssetBase = appDom.getSymbolAdaptee(fullName);

		if (!asset) {
			// eslint-disable-next-line max-len
			console.warn(`error: could not get asset ${name} for class ${instName}, no ActiveLoaderContext.loaderContext`);
		}

		if (asset) {
			if (asset instanceof MovieClip) {
				object.adaptee.graphics = asset.graphics;
			} else {
				object.adaptee = asset;
			}
		}
	}
	// @todo: this is a hack for getting adaptee
	// for dynamic created SimpleButton
	if (instName === 'SimpleButton') {
		object.adaptee = new MovieClip(new Timeline(this.sec.player.factory));
	}

	// mark object that it is AX object, not a regular class
	object[IS_AX_CLASS] = true;

	// eslint-disable-next-line prefer-spread
	object.axInitializer.apply(object,argArray);
	object.constructorHasRun = true;

	if (object.adaptee)
		OrphanManager.addOrphan(object.adaptee);

	if (object.isAVMFont) {
		// hack for font: make sure the fontName is set on Font
		object.fontName = instName;
	}
	return object;
}

const NEED_SLOW_CONSTRUCTOR: Record<string, boolean> = {
	'MovieClip': true,
	'DisplayObject': true,
	'Sprite': true,
	'Sound': true,
	'SimpleButton': true,
	'BitmapData': true
};

export function isFastConstructSupport(mn: Multiname, trace: string[]): boolean {
	let classInfo = mn.abc.applicationDomain.findClassInfoDeep(mn);

	// we not find class definition.. sorry
	if (!classInfo) {
		return false;
	}

	trace && trace.push(mn.name);

	while (classInfo && mn) {
		// This is special classes that require use slow constructor
		if (NEED_SLOW_CONSTRUCTOR[mn.name]) {
			return false;
		}

		mn = classInfo.instanceInfo.superName;

		if (!mn) {
			return true;
		}

		if (NEED_SLOW_CONSTRUCTOR[mn.name]) {
			return false;
		}

		trace && trace.push(mn.name);
		classInfo = mn.abc.applicationDomain.findClassInfoDeep(mn);

		if (!classInfo) {
			return true;
		}

		// top level class 'Object', all classes extends it and it not have super
		if (mn.name === 'Object' && mn.namespace.uri === '' && !classInfo.instanceInfo.superName) {
			return true;
		}

	}

	// if we can't traverse - use slow
	return false;
}

/**
 * Fast version of axConstruct, must be called when we strictly
 * know that elements not Interactive object and not have linked symbol,
 * this can save a lot of time for check
 */
export function axConstructFast(ctor: AXClass, args: any[]) {
	const object = Object.create(ctor.tPrototype);

	ctor.tPrototype.traits && initTraitsForObject(object, ctor.tPrototype.traits);

	// mark object that it is AX object, not a regular class
	object[IS_AX_CLASS] = true;

	Reflect.apply(object.axInitializer, object, args);

	object.constructorHasRun = true;

	return object;
}