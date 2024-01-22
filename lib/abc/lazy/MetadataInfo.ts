import { ABCFile } from './ABCFile';

export class MetadataInfo {
	constructor(
		public readonly abc: ABCFile,
		public readonly name: string,
		public readonly keys: string[],
		public readonly values: string[]
	) {
		// ...
	}

	getValue(key: string): string {
		for (let i = 0; i < this.keys.length; i++)
			if (this.keys[i] === key)
				return this.values[i];

		return null;
	}
}