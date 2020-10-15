import { Multiname } from '../abc/lazy/Multiname';

/**
 * @description Generate safe instruction for null block usage
 */
export class CallBlockSaver {
	_block: {alias: string} = null;
	_used: boolean = false;
	_needSafe: boolean = false;
	test(mn: Multiname) {
		return false;
	}

	markToSafe(mn: Multiname) {
		return this._needSafe = this.test(mn);
	}

	drop() {
		// we can drop already used block
		if (this._used) {
			return;
		}
		this._needSafe = false;
		this._block = undefined;
	}

	safe(alias: string) {
		this._block = { alias };
		this._used = false;
		return true;
	}

	needSafe(alias: string) {
		return this._needSafe && this._block && this._block.alias === alias;
	}

	beginSafeBlock(alias: string) {
		if (!this.needSafe(alias)) {
			return '';
		}

		this._used = true;
		return `if(${this._block.alias} != undefined) {`; // push block end;
	}

	endSafeBlock(fallback?: string) {
		if (!this._used) {
			return '';
		}

		const result = fallback ? `} else { ${this._block.alias} = ${fallback}; }` : '}';

		this._used = false;
		this._block = undefined;
		return result;
	}

	reset(): void {
		this._block = null;
		this._needSafe = false;
		this._used = false;
	}
}

export class TweenCallSaver extends CallBlockSaver {
	test(mn: Multiname) {
		return mn.namespaces && mn.namespace?.uri && mn.namespace.uri.includes('TweenLite');
	}
}