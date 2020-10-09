import { Multiname } from "./../abc/lazy/Multiname";
import { getExtClassField } from "../ext/external";
import { IGenerator } from './IGenerator';

export interface IImportDefinition {
	name: Multiname;
	alias: string;
	options: IImportGenOptions | undefined;
}
export interface IImportGenOptions {
	findProp?: boolean;
}

export interface ILexGenerator extends IGenerator {
	/**
	 * Test Multiname to support import generation
	 */
	test(mn: Multiname): boolean;

	findAliases(mn: Multiname, findProp: boolean): IImportDefinition[];
	/**
	 * Generate import alias if can be generated
	 * @throws lex import can't be generated
	 */
	getLexAlias(mn: Multiname, options?: IImportGenOptions): string;

	/**
	 * Generate import alias if can be generated
	 * @throws lex import can't be generated
	 */
	getPropStrictAlias(mn: Multiname, options?: IImportGenOptions): string;
}

export abstract class LexImportsGenerator implements ILexGenerator {
	imports: Array<IImportDefinition> = [];
	public test(mn: Multiname) {
		return false;
	}

	protected _genEntry(def: IImportDefinition): string {
		return `//` + def.name;
	}

	protected _genAlias(mn: Multiname, options?: IImportGenOptions): string {
		return mn.namespace.uri.replace(/\./g, "_") + "__" + mn.name;
	}

	findAliases(mn: Multiname, findProp: boolean): IImportDefinition[] {
		return this.imports.filter((e) => {
			return e.name === mn && (findProp ? findProp === e.options.findProp : true)
		});
	}

	public getLexAlias(mn: Multiname, options?: IImportGenOptions): string {
		return this.getPropStrictAlias(mn, Object.assign({findProp: true}, options || {}));
	}

	public getPropStrictAlias(mn: Multiname, options: IImportGenOptions = {findProp: false}): string {
		if (!this.test(mn)) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		}

		let def: IImportDefinition = this.imports.find((e) => {
			return e.name === mn && options.findProp === e.options.findProp
		});

		if (def) {
			return def.alias;
		}

		const alias = this._genAlias(mn, options);

		if(!this.imports.find((e) => e.alias === alias)) {
			this.imports.push({ 
				name: mn, 
				alias, 
				options 
			});
		}

		return alias;
	}

	public genHeader(ident: string = ""): string {
		if (!this.imports.length) {
			return "";
		}

		let header = [`\n${ident} /* ${this.constructor.name} */`];

		for (let def of this.imports) {
			header.push(ident + ' ' + this._genEntry(def));
		}

		header.push("\n");
		return header.join("\n");
	}

	public genBody(ident: string = ""): string {
		return "";
	}

	reset(): void {
		this.imports.length = 0;
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

	/**
	 * Return generator that will used for lex generation 
	 */
	public getGenerator(mn: Multiname): ILexGenerator | null {
		for (let g of this.generators) {
			if (g.test(mn)) {
				return g;
			}
		}
		return null;
	}

	public test(mn: Multiname): boolean {
		if (!this.generators.length) {
			return false;
		}

		return !!this.getGenerator(mn);
	}

	findAliases(mn: Multiname, findProp: boolean): IImportDefinition[] {
		let res = [];

		for(let g of this.generators) {
			res = res.concat(g.findAliases(mn, findProp));
		}

		return res;
	}

	/**
	 * Return generator that will used for propstrict generation 
	 */
	public getLexAlias(mn: Multiname, options?: IImportGenOptions): string {
		const gen = this.getGenerator(mn);

		if (!gen) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		}

		return gen.getLexAlias(mn, options);
	}

	public getPropStrictAlias(mn: Multiname, options?: any): string {
		const gen = this.getGenerator(mn);

		if (!gen) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		}

		return gen.getPropStrictAlias(mn, options);
	}

	public genHeader(ident: string): string {
		let header = "";

		for (let g of this.generators) {
			header += g.genHeader(ident);
		}

		return header;
	}

	public genBody(ident: string): string {
		let header = "";

		for (let g of this.generators) {
			header += g.genHeader(ident);
		}

		return header;
	}

	reset(): void {
		this.generators.forEach((e) => e.reset());
	}
}

/* -------------------- GENERATORS ------------------- */

/**
 * Import generator for Box2D and Nape external libs
 */
export class PhysicsLex extends LexImportsGenerator {
	constructor(public allows: { box2D?: boolean; nape?: boolean }) {
		super();
		this.allows = Object.assign({ box2D: true, nape: true }, allows)
	}

	protected _genEntry(def: IImportDefinition): string {
		const uri = def.name.namespace.uri;
		const name = def.name.name;

		return `const ${def.alias} = context.getStaticImportExt('${uri}', '${name}');`;
	}

	protected _genAlias(mn: Multiname, options?: IImportGenOptions): string {
		return mn.namespace.uri.replace(/\./g, "_") + "__" + mn.name;
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
	'flash.geom',
	'flash.utils', 
	'Math', 
	'trace' 	
];

const NOT_ALLOWED: String[] = [
	'getDefinitionByName',
	'SetIntervalTimer',
	'setTimeout',
	':trace'
]

interface ITopGenOptions extends IImportGenOptions {
	nameAlias: string;
}

export class TopLevelLex extends LexImportsGenerator {
	public test(mn: Multiname) {
		const uri = mn.namespace?.uri || "";
		const name = mn.name;

		if (typeof uri  === 'undefined') {
			return false;
		}

		if(
			NOT_ALLOWED.indexOf(name) > -1 || 
			NOT_ALLOWED.indexOf(uri) > -1) {
			return null;
		} 

		if(
			(ALLOWED_TOP_LEVEL_NAMES.indexOf(name) > -1 && !uri) || // trace, Math
			ALLOWED_TOP_LEVEL_NAMES.indexOf(uri) > -1)
		{
			return true;
		} 

		return false;
	}
	
	protected _genEntry(def: IImportDefinition): string {
		const uri = def.name.namespace.uri;
		const name = def.name.name;

		const { nameAlias, findProp } =  <ITopGenOptions> def.options || {};

		if(!nameAlias) {
			throw "Name alias required for generatin Toplevel exports!";
		}

		const id = Number(nameAlias.replace("name", ""));
		const mnname =  `['${Multiname.getPublicMangledName(name)}']`;

		return `const ${def.alias} = context.getTopLevel(${id})${ findProp ? mnname : ''}; // ${uri}:${name}`;
	}

	protected _genAlias(mn: Multiname, options: IImportGenOptions): string {
		const uri = mn.namespace.uri.split(/\./g);
		if(!(<any>options).nameAlias) {
			throw "Name alias required for generatin Toplevel exports!";
		}
		return `${uri.join('_')}__${mn.name}${options.findProp ? '' : '_def'}`;
	}
}