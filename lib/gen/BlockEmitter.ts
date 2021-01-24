export interface IBlock {
	supress: boolean;
	usage: number[];
	pos: number;

	set(...args: any[]): this;
	toString(): string;

	emitInline(): string;
	emitBlock(): string;

	name: string;
}

export interface IBlockValueEmitter {
	block: IBlock;
	toString(): string;
}

export class SimpleBlock implements IBlock {
	public supress: boolean = false;
	public usage: number[] = [];
	public ident: number = 0;

	public get name() {
		return '';
	}

	constructor(
		protected _emitter: BlockEmitter,
		public pos: number = 0) {}

	set(..._args: any) {

		this.ident = this._emitter._ident;
		return this;
	}

	emitInline() {
		return `// empty block at: ${this.pos}`;
	}

	emitBlock() {
		return this.emitInline();
	}

	getInlineEmitter(): IBlockValueEmitter {
		return {
			block: this,
			toString() {
				return this.block.emitInline();
			}
		};
	}

	getBlockEmitter(): IBlockValueEmitter {
		return {
			block: this,
			toString() {
				return this.block.emitBlock();
			}
		};
	}

	toString() {
		return this.emitBlock();
	}
}

export interface IVarValue {
	kind: 'simple' | 'expression' | 'stack' | 'local';
	value: any;
	declare?: boolean;
}

export class VariableBlock extends SimpleBlock {
	id: number = 0;
	value: IVarValue = null;
	type: 'local' | 'stack' = 'local';

	get name() {
		if (this.id === 0 && this.type === 'local')
			return '_this';

		return this.type + this.id;
	}

	set (id: number, value: IVarValue, type: 'local' | 'stack' = 'local') {
		this.id = id;
		this.value = value;
		this.type = type;

		return super.set();
	}

	_findValue() {
		const { kind, value } = this.value;

		if (kind === 'local' || kind === 'stack') {
			const nest = this._emitter.getVar(value, kind);

			if (nest.value.kind === 'simple') {
				return nest.emitInline();
			}

			return nest.name;
		}

		return this.value.value;
	}

	emitBlock() {
		return `${' '.repeat(this.ident)}${this.value.declare ? 'let ' : ''}${this.name} = ${this._findValue()};`;
	}

	emitInline() {
		return this._findValue();
	}

}

export class BlockEmitter {
	_variables: VariableBlock[] = [];
	_ident: number = 0;
	_identStr = '';
	_instrByPos: Record<number, IBlock[]> = {};

	// supress error on unresolved and emit requiest
	_emitUnresolved = true;

	pos: number = 0;

	moveIdent(dir: number) {
		this._ident += dir;
		if (this._ident < 0) this._ident = 0;

		return this.identStr;
	}

	get identStr() {
		if (this._identStr.length !== this._ident)
			this._identStr = ' '.repeat(this._ident);

		return this._identStr;
	}

	storeInst(block: IBlock) {
		const store = this._instrByPos[block.pos] || [];

		store.push(block);

		this._instrByPos[block.pos] = store;
	}

	emitVar(id: number,  type: 'local' | 'stack' = 'local', value: IVarValue): IBlockValueEmitter {
		const b = new VariableBlock(this, this.pos);

		b.set(id, value, type);

		this._variables.push(b);
		this.storeInst(b);

		return b.getBlockEmitter();
	}

	getVar(id: number, type: 'local' | 'stack' = 'local'): VariableBlock {
		let variable: VariableBlock;

		for (let i = this._variables.length - 1; i > 0; i--) {
			const v = this._variables[i];

			if (v.id === id && v.type === type) {
				variable = v;
				break;
			}
		}

		if (!variable) {
			if (!this._emitUnresolved) {
				throw `[BlockEmitter] Variable not resolved: ${type}${id}`;
			}

			return this.emitVar(id, type, {
				value: 'undefined',
				kind: 'local'
			}).block as VariableBlock;
		}

		variable.usage.push(this.pos);

		return variable;
	}
}