import { IGenerator } from "./IGenerator";
import { LexImportsGenerator, ILexGenerator } from "./LexImportsGenerator";
import { Multiname } from "../abc/lazy/Multiname";
import { Scope } from "../run/Scope";

export interface ICallEntry {
	name?: Multiname;
	alias: string;
	isMangled: boolean;
	fromLex: boolean;
	index: number;
	isFunc?: boolean;
	methodAlias?: string;
	methodImport?: string;
}

export class FastCall implements IGenerator {
	public safeIntrDistance = 20;

	private _active: StringMap<ICallEntry> = {};
	private _imports: ICallEntry[] = [];

	constructor(public lexer: ILexGenerator, public scope: Scope = null) {}

	checkNameToCall(mn: Multiname, propname: string, lex = false) {
		if (!this.scope) {
			return false;
		}

		const obj = this.scope.findScopeProperty(mn, true, false);
		if (!lex) {
			return obj && typeof obj[propname] === "function";
		}

		return obj && obj[mn.getMangledName()] && typeof obj[mn.getMangledName()][propname] === "function";
	}

	mark(alias: string, index: number, isMangled: boolean, name: Multiname = null, fromLex = false) {
		this._active[alias] = { alias, index, name, isMangled, fromLex };
	}

	sureThatFast(stackAlias: string, method?: string): ICallEntry {
		const d = this._active[stackAlias];

		if (!d || (method && !d.name)) {
			return null;
		}

		if (method && this.checkNameToCall(d.name, method, d.fromLex)) {
			d.isFunc = true;
		}

		return d;
	}

	getMethodAlias(stackAlias: string, method?: string): string | null {
		const d = this._active[stackAlias];

		if(!d || !d.isFunc || !d.name) {
			return null;
		}

		const lexedImportD = this.lexer.findAliases(d.name, false)[0];

		if(!lexedImportD) {
			return null;
		}

		const lexedImport = lexedImportD.alias;
		const methodALias = lexedImport + "_" + method;
		const declare = this._imports.find((e) => e.methodAlias === methodALias);

		if(declare) {
			return declare.methodAlias;
		} else {
			d.methodAlias = methodALias;
			d.methodImport = lexedImport + "." + method;

			this._imports.push(d);
		}

		return methodALias;
	}

	kill(stackAlias: string) {
		delete this._active[stackAlias];
	}

	killFar(index: number) {
		const keys = Object.keys(this._active);
		for (let k of keys) {
			if (index - this._active[k].index >= this.safeIntrDistance) {
				delete this._active[k];
			}
		}
	}

	genHeader(ident: string): string {
		const header = [`${ident} /* ${this.constructor.name} */`];
		
		for(let d of this._imports) {
			header.push(`${ident} const ${d.methodAlias} = ${d.methodImport};`);
		}

		header.push("\n");
		return header.join("\n");
	}

	genBody(): string {
		return "";
	}

	/**
	 * Drop fastCall cache
	 */
	drop() {
		this._active = {};
	}

	reset() {
		this._active = {};
		this._imports = [];
	}
}
