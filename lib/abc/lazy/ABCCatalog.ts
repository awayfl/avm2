import { assert, release } from '@awayfl/swf-loader';
import { AXApplicationDomain } from '../../run/AXApplicationDomain';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';

export class ABCCatalog {
	map: Record<string, Record<string, string>> = {};
	scripts: Record<string, any> = {};

	constructor(
		public app: AXApplicationDomain,
		public abcs: Uint8Array,
		index: any
	) {
		for (let i = 0; i < index.length; i++) {
			const abc = index[i];
			this.scripts[abc.name] = abc;
			release || assert(Array.isArray(abc.defs));
			for (let j = 0; j < abc.defs.length; j++) {
				const def = abc.defs[j].split(':');
				let nameMappings = this.map[def[1]];
				if (!nameMappings) {
					nameMappings = this.map[def[1]] = {};
				}
				nameMappings[def[0]] = abc.name;
			}
		}
	}

	getABCByScriptName(scriptName: string): ABCFile {
		const entry = this.scripts[scriptName];
		if (!entry) {
			return null;
		}
		const env = { url: scriptName, app: this.app };
		return new ABCFile(env, this.abcs.subarray(entry.offset, entry.offset + entry.length));
	}

	getABCByMultiname(mn: Multiname): ABCFile {
		const mappings = this.map[mn.name];
		if (!mappings) {
			return null;
		}
		const namespaces = mn.namespaces;
		for (let i = 0; i < namespaces.length; i++) {
			const ns = namespaces[i];
			const scriptName = mappings[ns.uri];
			if (scriptName) {
				return this.getABCByScriptName(scriptName);
			}
		}
		return null;
	}
}