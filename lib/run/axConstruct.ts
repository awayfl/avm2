import { MovieClip, SceneImage2D, FrameScriptManager, Sprite, DisplayObjectContainer, SimpleButton } from '@awayjs/scene';
import { AssetBase, WaveAudio } from '@awayjs/core';
import { BitmapImage2D } from '@awayjs/stage';
import { AXClass, IS_AX_CLASS } from './AXClass';
import { Multiname } from '../abc/lazy/Multiname';
import { AXApplicationDomain } from './AXApplicationDomain';

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

// todo: move OrphanManager elsewhere and add strong type
// maybe eve solve the orphan-issue in otherway alltogether
export class OrphanManager {

	static orphans: any[] = [];
	static addOrphan(orphan: any) {
		if (OrphanManager.orphans.indexOf(orphan) >= 0) {
			return;
		}
		OrphanManager.orphans.push(orphan);
	}

	static removeOrphan(orphan: any) {
		if (OrphanManager.orphans.indexOf(orphan) < 0) {
			return;
		}
		// todo: make this faster:
		const newOrphans = [];
		for (let i = 0; i < OrphanManager.orphans.length; i++) {
			if (OrphanManager.orphans[i] != orphan) {
				newOrphans.push(OrphanManager.orphans[i]);
			}
		}
		OrphanManager.orphans = newOrphans;
	}

	static updateOrphans() {
		for (let i = 0; i < OrphanManager.orphans.length; i++) {

			//if((<AwayMovieClip>OrphanManager.orphans[i].adaptee).isAsset(AwayMovieClip)){
			if (OrphanManager.orphans[i].adaptee.update) {
				OrphanManager.orphans[i].adaptee.update();
				FrameScriptManager.execute_as3_constructors_recursiv(OrphanManager.orphans[i].adaptee);
			} else if (OrphanManager.orphans[i].adaptee.advanceFrame) {
				OrphanManager.orphans[i].adaptee.advanceFrame();
				FrameScriptManager.execute_as3_constructors_recursiv(OrphanManager.orphans[i].adaptee);
			}
			// }
			// else{
			// 	(<any>OrphanManager.orphans[i]).advanceFrame(events);

			// }
			//(<any>OrphanManager.orphans[i]).dispatchQueuedEvents();
		}
	}
}

interface IAssetLookup {
	allowType: Array<any>;
	lookupMethod?: string;
	passToConstructor?: boolean; // pass asset to constructor?
}
type IAsseLookupTable = StringMap<IAssetLookup>;

// ASSET LOOKUP TABLE
// ClassType => AssetType
const ASSET_LOOKUP: IAsseLookupTable = {
	'Sound': {
		allowType: [WaveAudio],
		lookupMethod: 'getSymbolDefinition',
	},
	'BitmapData': {
		allowType: [SceneImage2D, BitmapImage2D],
		lookupMethod: 'getSymbolDefinition',
	},
	'BitmapAsset': {
		allowType: [SceneImage2D, BitmapImage2D],
		lookupMethod: 'getSymbolDefinition',
		passToConstructor: true
	},
	'Bitmap': {
		allowType: [SceneImage2D, BitmapImage2D],
		lookupMethod: 'getSymbolDefinition',
	},
};
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
	//	UNSAFE! Need check more clea because assets can has nested class defenetion, like as `BitmapAsset : FlexBitmap: Bitmap`

	const name = (<Multiname>_this.superClass?.classInfo?.instanceInfo?.name)?.name;
	const appDom: IAwayApplicationDomain = ActiveLoaderContext.loaderContext?.applicationDomain;
	//	const lookup: IAssetLookup = name ? ASSET_LOOKUP[name] : null;

	const mn =  (<Multiname>_this.classInfo.instanceInfo.name);
	const instName = mn.name;
	const fullName = mn.uri ? mn.uri + '.' + instName : instName;

	if (!timeline && appDom && appDom.hasSymbolForClass(fullName)) {
		const asset: AssetBase = appDom.getSymbolAdaptee(fullName);

		if (!asset) {
			console.warn(`error: could not get asset ${name} for class ${instName}, no ActiveLoaderContext.loaderContext`);
		}/* else {

			const isAsset = asset.isAsset && lookup.allowType.some((type) => asset.isAsset(type));

			if(!isAsset) {
				console.warn(`error: invalid asset type for class ${instName} of type ${name},
					recieved: ${asset ?? asset.assetType}, expected [${ lookup.allowType.map((e) => e.assetType).join()}]`);

				asset = null;
			}
		}*/

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

	object.axInitializer.apply(object,argArray);
	object.constructorHasRun = true;

	if (object.adaptee instanceof MovieClip || object.adaptee instanceof Sprite)
		OrphanManager.addOrphan(object);

	if (object.isAVMFont) {
		// hack for font: make sure the fontName is set on Font
		object.fontName = instName;
	}
	return object;
}
