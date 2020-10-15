import { AXApplicationDomain } from '../run/AXApplicationDomain';
import { nativeClassLoaderNames } from './builtinNativeClasses';
import { makeClassLoader } from '../nat/makeClassLoader';

/**
 * Installs class loaders for all the previously registered native classes.
 */
export function installClassLoaders(applicationDomain: AXApplicationDomain, container: Object) {
	for (let i = 0; i < nativeClassLoaderNames.length; i++) {
		const loaderName = nativeClassLoaderNames[i].name;
		const loaderAlias = nativeClassLoaderNames[i].alias;
		const nsType = nativeClassLoaderNames[i].nsType;
		makeClassLoader(applicationDomain, container, loaderName, loaderAlias, nsType);
	}
}