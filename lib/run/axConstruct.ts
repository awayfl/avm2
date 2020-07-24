import { MovieClip, SceneImage2D, FrameScriptManager } from '@awayjs/scene';
import { AssetBase, WaveAudio } from '@awayjs/core';
import { BitmapImage2D } from '@awayjs/stage';
import { AXClass } from './AXClass';
import { Multiname } from '../abc/lazy/Multiname';
import { AXApplicationDomain } from './AXApplicationDomain';


export class ActiveLoaderContext {	
	//	ActiveLoaderContext.loaderContext is a hack !
	//	in future the appDom should be provided by the symbol
	public static loaderContext: any;
}

// todo: move OrphanManager elsewhere and add strong type
// maybe eve solve the orphan-issue in otherway alltogether
export class OrphanManager {

	static orphans: any[] = [];
	static addOrphan(orphan: any) {
		if (OrphanManager.orphans.indexOf(orphan)>=0) {
			return;
		}
		OrphanManager.orphans.push(orphan);
	}
	static removeOrphan(orphan: any) {
		if (OrphanManager.orphans.indexOf(orphan)<0) {
			return;
		}
		// todo: make this faster:
		var newOrphans = [];
		for (var i = 0; i < OrphanManager.orphans.length; i++) {
			if (OrphanManager.orphans[i] != orphan) {
				newOrphans.push(OrphanManager.orphans[i]);
			}
		}
		OrphanManager.orphans = newOrphans;
	}
	static updateOrphans() {
		for (var i = 0; i < OrphanManager.orphans.length; i++) {
			
			//if((<AwayMovieClip>OrphanManager.orphans[i].adaptee).isAsset(AwayMovieClip)){
				OrphanManager.orphans[i].adaptee.update();
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
	"Sound": {
		allowType: [WaveAudio],
		lookupMethod: "getAwayJSAudio",
	},
	"BitmapData": {
		allowType: [SceneImage2D, BitmapImage2D],
		lookupMethod: "getDefinition",
	},
	"BitmapAsset": {
		allowType: [SceneImage2D, BitmapImage2D],
		lookupMethod: "getDefinition",
		passToConstructor: true
	}
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

	var object = Object.create(_this.tPrototype);
	var symbol=null;
	var timeline=null;
	var classToCheck = _this;
	//  find the AwayJS-timline that should be used for this MC. might be on superclass...
	while(classToCheck && !timeline){
		symbol = (<any>classToCheck)._symbol;
		if(symbol && symbol.timeline)
			timeline = symbol.timeline;
		classToCheck = classToCheck.superClass;
	}

	if (timeline) {
		FrameScriptManager._constructor_queueLevel++;
		var newMC = new MovieClip(timeline);
		object.adaptee = newMC;

		
		let foundUIComponent:boolean=false;
		let symbolClass:any=(<any>this)._symbol.symbolClass; 
		while(symbolClass && !foundUIComponent){
			if(symbolClass.name?.name=="UIComponent"){
				foundUIComponent=true;
			}
			else if(symbolClass.name?.name=="MovieClip"){
				symbolClass=null;
			}
			else if(symbolClass.name?.name=="Sprite"){
				foundUIComponent=true;
			}
			else if(symbolClass.superClass){
				symbolClass=symbolClass.superClass;
			}
			else{
				symbolClass=null;
			}
		}
		// 	hack to BadIceCreamFont compiledClip:
		//	the compiledClip "BadIcecreamFont" seem to behave different to other classes
		//	it seem to always stick to frame 0,
		//
		//	DANGER!!!
		//	MAY PRODUCE SIDE EFFECTS 

		const cn = (<any>this)._symbol.className;
		const freezeOnFirstFrame = foundUIComponent || (cn && (
			//anyThis._symbol.className == "BadIcecreamFont" ||
			cn.includes('Font'))
		);

		if(freezeOnFirstFrame) {
			const timeline = newMC.timeline;
			const targetTimeline = timeline;

			targetTimeline.frame_command_indices = <any>[timeline.frame_command_indices[0]];
			targetTimeline.frame_recipe = <any>[timeline.frame_recipe[0]];
			targetTimeline.keyframe_constructframes = [timeline.keyframe_constructframes[0]];
			targetTimeline.keyframe_durations = <any>[timeline.keyframe_durations[0]];
			targetTimeline.keyframe_firstframes = [timeline.keyframe_firstframes[0]];
			targetTimeline.keyframe_indices = [timeline.keyframe_indices[0]];	
		}
		newMC.reset();
		FrameScriptManager.execute_as3_constructors();
		OrphanManager.addOrphan(object);
	}


	//	ActiveLoaderContext.loaderContext is a hack !
	//	in future the appDom should be provided by the symbol
	//	UNSAFE! Need check more clea because assets can has nested class defenetion, like as `BitmapAsset : FlexBitmap: Bitmap`

	const name = (<Multiname>_this.superClass?.classInfo?.instanceInfo?.name).name;
	const appDom = ActiveLoaderContext.loaderContext?.applicationDomain;
	const lookup: IAssetLookup = ASSET_LOOKUP[name];

	if(lookup) {
		let asset: AssetBase = null;

		const instName = (<Multiname>_this.classInfo.instanceInfo.name).name;
		const paths = [
			instName, 
			(<Multiname>_this.classInfo.instanceInfo.name).uri + "." + instName
		];

		const method = appDom ? appDom[lookup.lookupMethod ?? "getDefinition" ] : null;
		
		if(!method) {
			console.warn(`error: could not get asset ${name} for class ${instName}, no ActiveLoaderContext.loaderContext`);
		} else {

			for(let i = 0; i < paths.length && !asset; i ++) {
				try {
					asset = method.call(appDom, paths[i]);
				} catch {};
			}

			if(!asset) {
				console.warn(`error: could not get asset ${name} for class ${instName}, no ActiveLoaderContext.loaderContext`);
			} else {

				const isAsset = asset.isAsset && lookup.allowType.some((type) => asset.isAsset(type));

				if(!isAsset) {
					console.warn(`error: invalid asset type for class ${instName} of type ${name},
						recieved: ${asset ?? asset.assetType}, expected [${ lookup.allowType.map((e) => e.assetType).join()}]`);
					
					asset = null;
				}
			}
		}

		asset && (object.adaptee = asset);
	}

	if(object.adaptee && object.adaptee.timeline){
		object.adaptee.timeline.resetScripts();
	}
	object.axInitializer.apply(object,argArray);
	if(object.initAdapter){
		object.executeConstructor=()=>{};
		object.initAdapter();
	}
	
	return object;
}
