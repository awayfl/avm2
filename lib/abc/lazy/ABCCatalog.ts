import { MapObject, ObjectUtilities, assert, release } from '@awayfl/swf-loader';
import { AXApplicationDomain } from '../../run/AXApplicationDomain';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';

export class ABCCatalog {
	map: MapObject<MapObject<string>>;
	abcs: Uint8Array;
	scripts: MapObject<any>;
	app: AXApplicationDomain;

	constructor(app: AXApplicationDomain, abcs: Uint8Array, index: any) {
		this.app = app;
		this.map = ObjectUtilities.createMap<MapObject<string>>();
		this.abcs = abcs;
		this.scripts = ObjectUtilities.createMap<string>();
		for (let i = 0; i < index.length; i++) {
			const abc = index[i];
			this.scripts[abc.name] = abc;
			release || assert(Array.isArray(abc.defs));
			for (let j = 0; j < abc.defs.length; j++) {
				const def = abc.defs[j].split(':');
				let nameMappings = this.map[def[1]];
				if (!nameMappings) {
					nameMappings = this.map[def[1]] = Object.create(null);
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