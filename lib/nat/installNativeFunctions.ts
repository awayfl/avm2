import { AXSecurityDomain } from '../run/AXSecurityDomain';
import { nativeFunctions } from './nativeFunctions';
import { createContainersFromPath } from '../nat/createContainersFromPath';

/**
 * Installs all the previously registered native functions on the AXSecurityDomain.
 *
 * Note that this doesn't use memoizers and doesn't run the functions' AS3 script.
 */
export function installNativeFunctions(sec: AXSecurityDomain) {
	for (const i in nativeFunctions) {
		const pathTokens = i.split('.');
		const funName = pathTokens.pop();
		const container = createContainersFromPath(pathTokens, sec);
		container[funName] = sec.boxFunction(nativeFunctions[i]);
	}
}
