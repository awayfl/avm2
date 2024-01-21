import { ABCFile } from './ABCFile';
import { Traits } from './Traits';

export interface ILocalInfo {
	readonly traits: Traits
	readonly abc: ABCFile;
}