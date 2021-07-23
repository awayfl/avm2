import { MovieClip, FrameScriptManager, DisplayObject, Sprite, DisplayObjectContainer } from '@awayjs/scene';
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
declare global {
	interface Window { WeakRef: typeof WeakRef}
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

		let orphan: DisplayObject;

		for (const key in this.orphans) {
			orphan = <DisplayObject> this.orphans[key];

			if (USE_WEAK && orphan) {
				orphan = (<any> orphan)?.deref();
			}

			if (orphan) {
				if (!orphan.parent) {
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
				object[traits.slots[i].name.getMangledName()] =  traits.slots[i].value;
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

	if (timeline) {
		const newMC = new MovieClip(timeline);
		object.adaptee = newMC;

		let foundUIComponent: boolean = false;
		if ((<any> this)._symbol) {
			let symbolClass: any = (<any> this)._symbol.symbolClass;
			while (symbolClass && !foundUIComponent) {
				if (symbolClass.name?.name == 'UIComponent') {
					foundUIComponent = true;
				} else if (symbolClass.name?.name == 'MovieClip') {
					symbolClass = null;
				} else if (symbolClass.name?.name == 'Sprite') {
					foundUIComponent = true;
				} else if (symbolClass.superClass) {
					symbolClass = symbolClass.superClass;
				} else {
					symbolClass = null;
				}
			}
			// 	hack to BadIceCreamFont compiledClip:
			//	the compiledClip "BadIcecreamFont" seem to behave different to other classes
			//	it seem to always stick to frame 0,
			//
			//	DANGER!!!
			//	MAY PRODUCE SIDE EFFECTS

			const cn = (<any> this)._symbol.className;
			const freezeOnFirstFrame = foundUIComponent || (cn && (
				//anyThis._symbol.className == "BadIcecreamFont" ||
				cn.includes('Font'))
			);

			if (freezeOnFirstFrame) {
				const timeline = newMC.timeline;
				const targetTimeline = timeline;

				targetTimeline.frame_command_indices = <any>[timeline.frame_command_indices[0]];
				targetTimeline.frame_recipe = <any>[timeline.frame_recipe[0]];
				targetTimeline.keyframe_constructframes = [timeline.keyframe_constructframes[0]];
				targetTimeline.keyframe_durations = <any>[timeline.keyframe_durations[0]];
				targetTimeline.keyframe_firstframes = [timeline.keyframe_firstframes[0]];
				targetTimeline.keyframe_indices = [timeline.keyframe_indices[0]];
			}
		}
		newMC.reset();
		FrameScriptManager.execute_as3_constructors_recursiv(newMC);
	}

	//	ActiveLoaderContext.loaderContext is a hack !
	//	in future the appDom should be provided by the symbol
	//	UNSAFE! Need check more clea because assets can has nested class defenetion,
	//  like as `BitmapAsset : FlexBitmap: Bitmap`

	const name = (<Multiname>_this.superClass?.classInfo?.instanceInfo?.name)?.name;
	let appDom: IAwayApplicationDomain;

	if (_this.axApplicationDomain && _this.axApplicationDomain.awayApplicationDomain) {
		appDom = _this.axApplicationDomain.awayApplicationDomain;
	} else if (ActiveLoaderContext.loaderContext) {
		appDom = ActiveLoaderContext.loaderContext.applicationDomain;
	}
	//	const lookup: IAssetLookup = name ? ASSET_LOOKUP[name] : null;

	const mn =  (<Multiname>_this.classInfo.instanceInfo.name);
	const instName = mn.name;
	const fullName = mn.uri ? mn.uri + '.' + instName : instName;

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
	if (this.classInfo?.instanceInfo?.name?.name == 'SimpleButton') {
		object.adaptee = new MovieClip();
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