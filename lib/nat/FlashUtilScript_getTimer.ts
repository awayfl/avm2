import { AXSecurityDomain } from '../run/AXSecurityDomain';
import { AVMStage } from '@awayfl/swf-loader';

export function FlashUtilScript_getTimer(sec: AXSecurityDomain) {
	return Date.now() - AVMStage.runtimeStartTime;
}
