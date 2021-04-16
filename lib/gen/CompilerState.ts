import { ABCFile } from '../abc/lazy/ABCFile';
import { MethodInfo } from '../abc/lazy/MethodInfo';
import { Multiname } from './../abc/lazy/Multiname';

export class CompilerState {
	public names: Multiname[] = [];
	private _indent: string = '';
	private _indentLen: number = 0;

	public get indent() {
		return this.indent;
	}

	public abc: ABCFile;

	constructor(
		public methodInfo: MethodInfo
	) {
		this.abc = methodInfo.abc;
	}

	public setMoveIndent (offset: number) {
		this._indentLen += offset * 4;
		if (this._indentLen < 0)
			this._indentLen = 0;

		this._indent = (' ').repeat(this._indentLen ? this._indentLen - 1 : 0);

		return this._indent;
	}

	public setUseName(multiname: Multiname): boolean {
		return true;
	}
}