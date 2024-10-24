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
import { Traits } from '../abc/lazy/Traits';
import { IGlobalInfo } from '../abc/lazy/IGlobalInfo';

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
				const mn = c.instanceInfo.multiname;
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
		interpret(scriptInfo.methodInfo, global.scope, null).apply(global, []);
		scriptInfo.state = ScriptInfoState.Executed;
	}

	public findProperty(mn: Multiname, _strict: boolean, execute: boolean): AXGlobal {
		if (mn.globalInfo)
			return mn.globalInfo.global;

		const globalInfo: IGlobalInfo = <IGlobalInfo> Traits.getGlobalTrait(mn)?.holder
			|| this.findDefiningGlobal(mn, execute);

		if (!globalInfo)
			return;

		if (!mn.mutable)
			mn.globalInfo = globalInfo;

		if (execute && globalInfo instanceof ScriptInfo && globalInfo.state === ScriptInfoState.None) {
			this.executeScript(globalInfo);
		}

		return globalInfo.global || (globalInfo.global = this.sec.createAXGlobal(this, globalInfo));
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
		if (global)
			return global.axGetProperty(mn);

		if (mn.name != 'void')
			this.sec.throwError('ReferenceError', Errors.DefinitionNotFoundError, mn.name);
	}

	public findDefiningGlobal(mn: Multiname, execute: boolean): IGlobalInfo {

		// Look in parent domain first.
		let globalInfo: IGlobalInfo;

		// Still no luck, so let's ask the security domain to load additional ABCs and try again.
		const abc: ABCFile = this.system.sec.findDefiningABC(mn);
		if (abc) {
			this.loadABC(abc);
			globalInfo = <IGlobalInfo> Traits.getGlobalTrait(mn)?.holder;
			release || assert(globalInfo, 'Shall find class in loaded ABC');

			return globalInfo;
		}

		return null;
	}
}