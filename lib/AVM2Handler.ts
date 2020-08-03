import { IAVMHandler, AVMVERSION, AVMStage, SWFFile, PromiseWrapper, release, SWFParser } from "@awayfl/swf-loader"
import { AVM2LoadLibrariesFlags } from "./AVM2LoadLibrariesFlags";

import {initSystem} from "./natives/system";
import {initlazy} from "./abc/lazy";

import { IAsset } from '@awayjs/core';

import { IPlayerGlobal } from "./IPlayerGlobal";
import { ISceneGraphFactory } from '@awayjs/scene';
import { initializeAXBasePrototype } from "./run/initializeAXBasePrototype";

export class AVM2Handler implements IAVMHandler {

	public avmVersion: string = AVMVERSION.AVM2;

	private _avmStage: AVMStage;
	private _factory: ISceneGraphFactory;

	private _playerglobal:IPlayerGlobal;

	constructor(playerglobal:IPlayerGlobal){
		
		if(!playerglobal) throw("AVM2Handler must be init with a valid PlayerGlobal-class");
		this._playerglobal=playerglobal;
	}

	public init(avmStage: AVMStage, swfFile: SWFFile, callback: (hasInit:boolean)=>void) {

		if(this._avmStage){
			callback(false);
		}

		this._avmStage = avmStage;
		this._avmStage.scene.mouseManager._stage = this._avmStage;

		initSystem();
		initializeAXBasePrototype();
		initlazy();

		// Add the |axApply| and |axCall| methods on the function prototype so that we can treat
		// Functions as AXCallables.
		(<any>Function.prototype).axApply = Function.prototype.apply;
		(<any>Function.prototype).axCall = Function.prototype.call;

		this._playerglobal.createSecurityDomain(
			avmStage,
			swfFile,
			AVM2LoadLibrariesFlags.Builtin | AVM2LoadLibrariesFlags.Playerglobal
		).then((factory: ISceneGraphFactory) => {
			release || console.log("playerglobal has init");
			this._factory=factory;
			callback(true);
		});
	}
	public enterFrame(dt:number) {
		this._playerglobal.enterFrame();
	}

	public resizeStage() {
		this._playerglobal.resizeStage();
	}
	
	public get factory(): ISceneGraphFactory {
		if (!this._factory)
			throw ("AVM2Handler - no Factory get factory");
		return this._factory;
	}

	public addAsset(asset:IAsset, addScene:boolean) {
		this._playerglobal.addAsset(asset, addScene)
	}
}