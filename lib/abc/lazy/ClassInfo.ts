import { Info } from './Info';
import { ClassTraitInfo } from './ClassTraitInfo';
import { RuntimeTraits } from './RuntimeTraits';
import { ABCFile } from './ABCFile';
import { InstanceInfo } from './InstanceInfo';
import { MethodInfo } from './MethodInfo';
import { Traits } from './Traits';
import { MetadataInfo } from './MetadataInfo';
import { IndentingWriter } from '@awayfl/swf-loader';
import { AXGlobal } from '../../run/AXGlobal';
import { IGlobalInfo } from './IGlobalInfo';

export class ClassInfo extends Info implements IGlobalInfo {
	public global: AXGlobal = null;
	public trait: ClassTraitInfo = null;
	public runtimeTraits: RuntimeTraits = null;
	constructor(
		public readonly abc: ABCFile,
		public readonly instanceInfo: InstanceInfo,
		public readonly methodInfo: MethodInfo,
		public readonly traits: Traits
	) {
		super(traits);
	}

	public getNativeMetadata(): MetadataInfo {
		const metadata = this.trait?.metadata;
		if (!metadata)
			return null;

		for (let i = 0; i < metadata.length; i++)
			if (metadata[i].name === 'native')
				return metadata[i];

		return null;
	}

	public toString() {
		return 'ClassInfo ' + this.instanceInfo.multiname;
	}

	public trace(writer: IndentingWriter) {
		writer.enter('ClassInfo');
		this.traits.trace(writer);
		writer.outdent();
	}
}
