import { AXGlobal } from '../../run/AXGlobal';
import { ILocalInfo } from './ILocalInfo';

export interface IGlobalInfo extends ILocalInfo {
	global: AXGlobal;
}