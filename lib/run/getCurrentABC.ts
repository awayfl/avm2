import { scopeStacks } from './scopeStacks';
import { ABCFile } from '../abc/lazy/ABCFile';
import { AXGlobal } from './AXGlobal';

export function getCurrentABC(): ABCFile {
	if (scopeStacks.length === 0) {
		return null;
	}
	const globalObject = <AXGlobal> scopeStacks[scopeStacks.length - 1].topScope().global.object;
	return globalObject.globalInfo.abc;
}