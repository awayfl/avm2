import { Multiname } from './../abc/lazy/Multiname';
import { getExtClassField, extClasses } from '../ext/external';
import { IGenerator } from './IGenerator';
import { NamespaceType } from '../abc/lazy/NamespaceType';

export interface IImportDefinition {
	name: Multiname;
	alias: string;
	options: IImportGenOptions | undefined;
}
export interface IImportGenOptions {
	findProp?: boolean;
	scope?: string;
}

export interface ILexGenerator extends IGenerator {
	/**
	 * Test Multiname to support import generation
	 */
	test(mn: Multiname, isLexCall: boolean): boolean;

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
	private _lexMode = false;

	public test(_mn: Multiname, _isLexCall: boolean) {
		return false;
	}

	protected _genEntry(def: IImportDefinition, ...args: any[]): string {
		return '//' + def.name;
	}

	protected _genAlias(mn: Multiname, _options?: IImportGenOptions): string {
		return mn.namespace.uri.replace(/\./g, '_') + '__' + mn.name;
	}

	findAliases(mn: Multiname, findProp: boolean): IImportDefinition[] {
		return this.imports.filter((e) => {
			return e.name === mn && (findProp ? findProp === e.options.findProp : true);
		});
	}

	public getLexAlias(mn: Multiname, options?: IImportGenOptions): string {
		this._lexMode = true;
		const res = this.getPropStrictAlias(mn, Object.assign({ findProp: true }, options || {}));

		this._lexMode = false;
		return res;
	}

	public getPropStrictAlias(
		mn: Multiname, options: IImportGenOptions = { findProp: false }): string {

		if (!this.test(mn, this._lexMode)) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		}

		const def: IImportDefinition = this.imports.find((e) => {
			return e.name === mn && options.findProp === e.options.findProp;
		});

		if (def) {
			return def.alias;
		}

		const alias = this._genAlias(mn, options);

		if (!this.imports.find((e) => e.alias === alias)) {
			this.imports.push({
				name: mn,
				alias,
				options
			});
		}

		return alias;
	}

	public genHeader(ident: string = '', ...args: any[]): string {
		if (!this.imports.length) {
			return '';
		}

		const header = [`\n${ident} /* ${this.constructor.name} */`];

		for (const def of this.imports) {
			header.push(ident + ' ' + this._genEntry(def));
		}

		header.push('\n');
		return header.join('\n');
	}

	public genBody(_ident: string = '', ..._args: any[]): string {
		return '';
	}

	public genPost(input: string[]): string[] {
		return input;
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
			throw 'Generators array can\'t be null';
		}
	}

	/**
	 * Return generator that will used for lex generation
	 */
	public getGenerator(mn: Multiname, isLexCall: boolean): ILexGenerator | null {
		for (const g of this.generators) {
			if (g.test(mn, isLexCall)) {
				return g;
			}
		}
		return null;
	}

	public test(mn: Multiname, isLexCall: boolean): boolean {
		if (!this.generators.length) {
			return false;
		}

		return !!this.getGenerator(mn, isLexCall);
	}

	findAliases(mn: Multiname, findProp: boolean): IImportDefinition[] {
		let res = [];

		for (const g of this.generators) {
			res = res.concat(g.findAliases(mn, findProp));
		}

		return res;
	}

	/**
	 * Return generator that will used for propstrict generation
	 */
	public getLexAlias(mn: Multiname, options?: IImportGenOptions): string {
		const gen = this.getGenerator(mn, true);

		if (!gen) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		}

		return gen.getLexAlias(mn, options);
	}

	public getPropStrictAlias(mn: Multiname, options?: any): string {
		const gen = this.getGenerator(mn, false);

		if (!gen) {
			throw `Can't generate static alias for ${mn.name} of ${mn.namespace?.uri}`;
		}

		return gen.getPropStrictAlias(mn, options);
	}

	public genHeader(ident: string): string {
		let header = '';

		for (const g of this.generators) {
			header += g.genHeader(ident);
		}

		return header;
	}

	public genBody(ident: string): string {
		let body = '';

		for (const g of this.generators) {
			body += g.genBody(ident);
		}

		return body;
	}

	public genPost(arr: string[]): string[] {
		for (const g of this.generators) {
			arr = g.genPost(arr);
		}

		return arr;
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
		this.allows = Object.assign({ box2D: true, nape: true }, allows);
	}

	protected _genEntry(def: IImportDefinition): string {
		const uri = def.name.namespace.uri;
		const name = def.name.name;

		return `const ${def.alias} = context.getStaticImportExt('${uri}', '${name}');`;
	}

	protected _genAlias(mn: Multiname, _options?: IImportGenOptions): string {
		return mn.namespace.uri.replace(/\./g, '_') + '__' + mn.name;
	}

	public test(mn: Multiname) {
		const uri = mn.namespace?.uri;

		if (!uri || !extClasses.lib) {
			return false;
		}

		// generate static for box2D
		if (uri.startsWith('Box2D') && this.allows.box2D) {
			return !!getExtClassField(mn.name);
		}

		if (!uri.startsWith('nape.') || !this.allows.nape) {
			return false;
		}

		if (mn.name.includes('Debug')) {
			return false;
		}

		return true;
	}
}

const ALLOWED_TOP_LEVEL_NAMES: String[] = [
	'flash.geom',
	'flash.utils',
	'Math',
	'trace',
	'parseInt'
];

const NOT_ALLOWED: String[] = [
	'getDefinitionByName',
	'SetIntervalTimer',
	'setTimeout',
	':trace'
];

interface ITopGenOptions extends IImportGenOptions {
	nameAlias: string;
}
/**
 * @description Generete single constant reference on top level API props: trace, pareseInt etc
 */
export class TopLevelLex extends LexImportsGenerator {
	public test(mn: Multiname) {
		const uri = mn.namespace?.uri || '';
		const name = mn.name;

		if (typeof uri  === 'undefined') {
			return false;
		}

		if (
			NOT_ALLOWED.indexOf(name) > -1 ||
			NOT_ALLOWED.indexOf(uri) > -1) {
			return null;
		}

		if (
			(ALLOWED_TOP_LEVEL_NAMES.indexOf(name) > -1 && !uri) || // trace, Math
			ALLOWED_TOP_LEVEL_NAMES.indexOf(uri) > -1) {
			return true;
		}

		return false;
	}

	protected _genEntry(def: IImportDefinition): string {
		const uri = def.name.namespace.uri;
		const name = def.name.name;

		const { nameAlias, findProp } =  <ITopGenOptions> def.options || {};

		if (!nameAlias) {
			throw 'Name alias required for generatin Toplevel exports!';
		}

		const id = Number(nameAlias.replace('name', ''));
		const mnname =  `['${Multiname.getPublicMangledName(name)}']`;

		return `const ${def.alias} = context.getTopLevel(${id})${ findProp ? mnname : ''}; // ${uri}:${name}`;
	}

	protected _genAlias(mn: Multiname, options: IImportGenOptions): string {
		const uri = mn.namespace.uri.split(/\./g);
		if (!(<any>options).nameAlias) {
			throw 'Name alias required for generatin Toplevel exports!';
		}
		return `${uri.join('_')}__${mn.name}${options.findProp ? '' : '_def'}`;
	}
}

interface StaticHoistLexGenOptions extends IImportGenOptions {
	nameAlias: string;
	scope: string;
}

/**
 * @description Generate single reference on class namespace/class with static field
 */
export class StaticHoistLex extends LexImportsGenerator {
	private _mn: Set<Multiname> = new Set<Multiname>();
	private _loc: Record<string, number> = {};

	markScope(name: string, pos: number = 0) {
		if (!pos) {
			throw 'Scope location should be marked!';
		}

		this._loc[name] = pos;
	}

	test (mn: Multiname, isLexCall: boolean) {
		if (!isLexCall) {
			return false;
		}

		// when there are not URI and no public - skip
		if (!mn.uri || mn.namespace.type !== NamespaceType.Public) {
			return false;
		}

		if (!this._mn.has(mn)) {
			this._mn.add(mn);
			return false;
		}

		return true;
	}

	protected _genAlias(mn: Multiname, options: IImportGenOptions): string {
		const uri = mn.namespace.uri.split(/[.|:]/g);
		const opt = <StaticHoistLexGenOptions> options;

		if (!opt.nameAlias) {
			throw 'Name alias required for generatin FirstUsageScopeLex exports!';
		}

		if (!opt.scope) {
			throw 'Scope alias required for generatin FirstUsageScopeLex exports!';
		}

		return `${uri.join('_')}__${mn.name}`;
	}

	findAliases() {
		return [];
	}

	genHeader () {
		return '';
	}

	genBody (idnt: string) {
		if (!this.imports.length) {
			return '';
		}

		const body = [`${idnt} // ${this.constructor.name} `];

		for (const imp of this.imports) {
			body.push(`${idnt} let ${imp.alias}; // ${imp.name}`);
		}

		return body.join('\n');
	}

	genPost(arr: string[]): string[] {

		for (const def of this.imports) {
			const opt = def.options as ITopGenOptions;
			const loc = this._loc[opt.scope];

			if (!loc) {
				throw 'Unknow import for scope:' + opt.scope;
			}

			//@ts-ignore
			const idnt = arr[loc].length - arr[loc].trimLeft().length - 1;

			arr.splice(loc + 1, 0, this._genEntry(def, ' '.repeat(idnt)));
		}

		return arr;
	}

	_genEntry(def: IImportDefinition, idnt: string = ' ') {
		const js = [];
		const mn = def.name;
		const opt = def.options as ITopGenOptions;

		js.push(`${idnt} // `);
		js.push(`${idnt} // ${mn}`);
		js.push(`${idnt} temp = ${opt.scope}.findScopeProperty(${opt.nameAlias}, true, false);`);
		js.push(`${idnt} ${def.alias} = temp['$Bg${mn.name}'];`);
		js.push(`${idnt} if (${def.alias} === undefined || typeof ${def.alias} === 'function') {`);
		js.push(`${idnt}     ${def.alias} = temp.axGetProperty(${opt.nameAlias});`);
		js.push(`${idnt} }`);

		return js.join('\n');
	}
}