import { ABCFile } from '../abc/lazy/ABCFile';
import { ScriptInfo } from '../abc/lazy/ScriptInfo';
import { Multiname } from '../abc/lazy/Multiname';
import { Errors } from '../errors';
import { AXSecurityDomain } from './AXSecurityDomain';
import { assert } from '@awayjs/graphics';
import { ScriptInfoState } from './ScriptInfoState';
import { runtimeWriter } from './writers';
import { interpret } from '../int';
import { AXGlobal } from './AXGlobal';
import { release } from '@awayfl/swf-loader';
import { AXClass } from './AXClass';
import { AXObject } from './AXObject';
import { ClassInfo } from '../abc/lazy/ClassInfo';

/**
 * All code lives within an application domain.
 */
export class AXApplicationDomain {
	/**
     * All application domains have a reference to the root, or system application domain.
     */
	public system: AXApplicationDomain;

	/**
     * Parent application domain.
     */
	public parent: AXApplicationDomain;

	public sec: AXSecurityDomain;

	// back reference to Playerglobal appDomain
	public awayApplicationDomain: any;

	private _abcs: ABCFile [];
	private _binarySymbols: any;

	constructor(sec: AXSecurityDomain, parent: AXApplicationDomain) {
		this.sec = sec;
		this.parent = parent;
		this.system = parent ? parent.system : this;
		this._abcs = [];
		this._binarySymbols = {};
	}

	public addBinarySymbol(symbol: any) {
		this._binarySymbols[symbol.className] = symbol;
	}

	public getBinarySymbol(className: string): any {
		return this._binarySymbols[className];
	}

	public loadABC(abc: ABCFile) {
		assert (this._abcs.indexOf(abc) < 0);
		this._abcs.push(abc);
	}

	public loadAndExecuteABC(abc: ABCFile) {
		this.loadABC(abc);
		this.executeABC(abc);
	}

	public executeABC(abc: ABCFile) {
		const lastScript = abc.scripts[abc.scripts.length - 1];
		this.executeScript(lastScript);
	}

	public findClassInfoDeep (name: string | Multiname): ClassInfo | null {

		let info = this.findClassInfo(name);

		if (info)
			return info;

		if (this.parent) {
			info = this.parent.findClassInfo(name);

			if (info)
				return info;
		}

		return null;
	}

	public findClassInfo(name: string | Multiname): ClassInfo | null {
		const argName = typeof name === 'string' ? name : name.name;
		const uri =  typeof name === 'string' ? '' : name.namespaces[0].uri;
		for (let i = 0; i < this._abcs.length; i++) {
			const abc = this._abcs[i];
			for (let j = 0; j < abc.instances.length; j++) {
				const c = abc.classes[j];
				const mn = c.instanceInfo.getName();
				if (mn.name === argName && mn.namespaces[0].uri == uri) {
					return c;
				}
			}
		}
		return null;
	}

	public executeScript(scriptInfo: ScriptInfo) {
		assert (scriptInfo.state === ScriptInfoState.None);

		runtimeWriter && runtimeWriter.writeLn('Running Script: ' + scriptInfo);
		const global = this.sec.createAXGlobal(this, scriptInfo);
		scriptInfo.global = global;
		scriptInfo.state = ScriptInfoState.Executing;
		interpret(scriptInfo.getInitializer(), global.scope, null).apply(global, []);
		scriptInfo.state = ScriptInfoState.Executed;
	}

	public findProperty(mn: Multiname, _strict: boolean, execute: boolean): AXGlobal {
		const script: ScriptInfo = this.findDefiningScript(mn, execute);
		if (script) {
			return script.global;
		}
		return null;
	}

	public getClass(mn: Multiname): AXClass {
		const classObject = <AXClass> this.getProperty(mn, true, true);

		if (classObject && !classObject.axApplicationDomain) {
			classObject.axApplicationDomain = this;
		}

		return classObject;
	}

	public getProperty(mn: Multiname, strict: boolean, execute: boolean): AXObject {
		const global: AXGlobal = this.findProperty(mn, strict, execute);
		if (global) {
			return global.axGetProperty(mn);
		}

		if (mn.name != 'void') {
			this.sec.throwError('ReferenceError', Errors.DefinitionNotFoundError, mn.name);
		}
	}

	public findDefiningScript(mn: Multiname, execute: boolean): ScriptInfo {
		if (mn.script)
			return mn.script;

		// Look in parent domain first.
		let script: ScriptInfo;
		if (this.parent) {
			script = this.parent.findDefiningScript(mn, execute);
			if (script) {
				return script;
			}
		}

		// Search through the loaded abcs.
		for (let i = 0; i < this._abcs.length; i++) {
			const abc = this._abcs[i];
			script = this._findDefiningScriptInABC(abc, mn, execute);
			if (script) {
				if (!mn.mutable)
					mn.script = script;
				return script;
			}
		}

		// Still no luck, so let's ask the security domain to load additional ABCs and try again.
		const abc: ABCFile = this.system.sec.findDefiningABC(mn);
		if (abc) {
			this.loadABC(abc);
			script = this._findDefiningScriptInABC(abc, mn, execute);
			release || assert(script, 'Shall find class in loaded ABC');
			if (!mn.mutable)
				mn.script = script;
			return script;
		}

		return null;
	}

	private _findDefiningScriptInABC(abc: ABCFile, mn: Multiname, execute: boolean): ScriptInfo {
		const scripts = abc.scripts;
		for (let j = 0; j < scripts.length; j++) {
			const script = scripts[j];
			const traits = script.traits;
			traits.resolve();
			if (traits.getTrait(mn)) {
				// Ensure script is executed.
				if (execute && script.state === ScriptInfoState.None) {
					this.executeScript(script);
				}
				return script;
			}
		}
		return null;
	}
}