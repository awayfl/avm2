import { AXObject } from './AXObject';
import { AXSecurityDomain } from './AXSecurityDomain';
import { AXApplicationDomain } from './AXApplicationDomain';
import { Scope } from './Scope';
import { IGlobalInfo } from '../abc/lazy/IGlobalInfo';

export interface AXGlobal extends AXObject {
	sec: AXSecurityDomain;
	applicationDomain: AXApplicationDomain;
	globalInfo: IGlobalInfo;
	scope: Scope;
}