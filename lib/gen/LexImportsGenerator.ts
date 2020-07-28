import { Multiname } from "./../abc/lazy/Multiname";
import { getExtClassField } from "../ext/external";

export interface IImportDefinition {
	name: Multiname;
	alias: string;
	opt: any | undefined;
}
export interface ILexGenerator {
	/**
	 * Test Multiname to support import generation
	 */
	test(mn: Multiname): boolean;

	/**
	 * Generate import alias if can be generated
	 * @throws lex import can't be generated
	 */
	getStaticAlias(mn: Multiname, options?: any): string;

	/**
	 * Generate header (before method anotation) of imports when it exist, or return empty string
	 */
	genHeader(): string;

	/**
	 * Generate body (after method annotations), return empty string
	 */
	genBody(): string;
}

export abstract class LexImportsGenerator implements ILexGenerator {
	imports: Array<IImportDefinition> = [];
	public test(mn: Multiname) {
		return false;
	}

	protected _genEntry(def: IImportDefinition): string {
		const uri = def.name.namespace.uri;
		const name = def.name.name;

		return `const ${def.alias} = context.getStaticImportExt('${uri}', '${name}');`;
	}

	protected _genAlias(mn: Multiname, options?: any): string {
		return mn.namespace.uri.replace(/\./g, "_") + "__" + mn.name;
	}

	public getStaticAlias(mn: Multiname, options?: any): string {
		if (!this.test(mn)) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		}

		let def: IImportDefinition = this.imports.find((e) => e.name === mn);

		if (def) {
			return def.alias;
		}

		const alias = this._genAlias(mn, options);

		def = { name: mn, alias, opt: options ?  Object.assign({}, options) : undefined };

		this.imports.push(def);

		return alias;
	}

	public genHeader(): string {
		if (!this.imports.length) {
			return "";
		}

		let header = [`\n/* ${this.constructor.name} */`];

		for (let def of this.imports) {
			header.push(this._genEntry(def));
		}

		header.push("\n");
		return header.join("\n");
	}

	public genBody(): string {
		return "";
	}
}


/**
 * Generate imports for all lex generators
 */
export class ComplexGenerator implements ILexGenerator {
	/**
	 * Allowed collsion for alias of generator, return first alias;
	 */
	public allowColissions: Boolean = false;
	constructor(public generators: ILexGenerator[]) {
		if (!generators) {
			throw "Generators array can't be null";
		}
	}

	test(mn: Multiname): boolean {
		if (!this.generators.length) {
			return false;
		}

		for (let g of this.generators) {
			if (g.test(mn)) {
				return true;
			}
		}

		return false;
	}

	getStaticAlias(mn: Multiname, options?: any): string {
		const gens = this.generators.filter((e) => e.test(mn));

		if (!gens.length) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		} else if (gens.length > 1 && !this.allowColissions) {
			throw `Alias collision for for ${mn.name} of ${mn.namespace?.uri}`;
		}

		return gens[0].getStaticAlias(mn, options);
	}

	genHeader(): string {
		let header = "";

		for (let g of this.generators) {
			header += g.genHeader();
		}

		return header;
	}

	genBody(): string {
		let header = "";

		for (let g of this.generators) {
			header += g.genHeader();
		}

		return header;
	}
}

/* -------------------- GENERATORS ------------------- */

/**
 * Import generator for Box2D and Nape external libs
 */
export class PhysicsLex extends LexImportsGenerator {
	constructor(public allows: { box2D?: boolean; nape?: boolean } = { box2D: true, nape: true }) {
		super();
	}

	public test(mn: Multiname) {
		const uri = mn.namespace?.uri;

		if (!uri) {
			return false;
		}

		// generate static for box2D
		if (uri.startsWith("Box2D") && this.allows.box2D) {
			return !!getExtClassField(mn.name);
		}

		if (!uri.startsWith("nape.") || !this.allows.nape) {
			return false;
		}

		if (mn.name.includes("Debug")) {
			return false;
		}
		return true;
	}
}

const ALLOWED_TOP_LEVEL_NAMES: String[] = [
	'flash.utils', 
	'Math', 
	'trace' 	
]

export class TopLevelLex extends LexImportsGenerator {
	public test(mn: Multiname) {
		const uri = mn.namespace?.uri;
		const name = mn.name;

		if (typeof uri  === 'undefined') {
			return false;
		}

		if(
			ALLOWED_TOP_LEVEL_NAMES.indexOf(name) > -1 || // trace, Math
			ALLOWED_TOP_LEVEL_NAMES.indexOf(uri) > -1)
		{
			return true;
		} 

		return false;
	}
	
	protected _genEntry(def: IImportDefinition): string {
		const uri = def.name.namespace.uri;
		const name = def.name.name;
		const nameAlisas: string = def.opt?.nameAlias;
		const strict: boolean = def.opt?.strict;

		if(!nameAlisas) {
			throw "Name alias required for generatin Toplevel exports!";
		}

		const id = Number(nameAlisas.replace("name", ""));
		const mnname =  `'${Multiname.getPublicMangledName(name)}'`;

		return `const ${def.alias} = context.getTopLevel(${id}, ${strict ? mnname : '' }); // ${uri}:${name}`;
	}

	protected _genAlias(mn: Multiname, options: {nameAlias: string}): string {
		const hasUri = !!mn.namespace.uri;
		const uri = mn.namespace.uri.split(/\./g);
		const prf = ['Top', ...uri];

		return `${prf.join('_')}${ (hasUri ? "" : ("__" + mn.name))}`;
	}
}