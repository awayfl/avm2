import { AVM2LoadLibrariesFlags } from './AVM2LoadLibrariesFlags';
import { AVMStage, SWFFile } from '@awayfl/swf-loader';
import { ISceneGraphFactory } from '@awayjs/scene';
import { IAsset } from '@awayjs/core';

export interface IPlayerGlobal{
	createSecurityDomain(
		avmStage:AVMStage,
		swfFile:SWFFile,
		libraries: AVM2LoadLibrariesFlags
	): Promise<ISceneGraphFactory>;
	
	enterFrame();

	resizeStage();
	
	addAsset(asset: IAsset, addScene:boolean);
}