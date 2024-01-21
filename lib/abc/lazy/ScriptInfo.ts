import { Info } from './Info';
import { AXGlobal } from '../../run/AXGlobal';
import { ScriptInfoState } from '../../run/ScriptInfoState';
import { ABCFile } from './ABCFile';
import { Traits } from './Traits';
import { MethodInfo } from './MethodInfo';
import { IGlobalInfo } from './IGlobalInfo';
import { IndentingWriter } from '@awayfl/swf-loader';

export class ScriptInfo extends Info implements IGlobalInfo {
	public global: AXGlobal = null;
	public state: ScriptInfoState = ScriptInfoState.None;
	constructor(
		public readonly abc: ABCFile,
		public readonly methodInfo: MethodInfo,
		public readonly traits: Traits
	) {
		super(traits);
	}

	trace(writer: IndentingWriter) {
		writer.enter('ScriptInfo');
		this.traits.trace(writer);
		writer.outdent();
	}
}