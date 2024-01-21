import { Info } from './Info';
import { ClassInfo } from './ClassInfo';
import { RuntimeTraits } from './RuntimeTraits';
import { AXClass } from '../../run/AXClass';
import { ABCFile } from './ABCFile';
import { Multiname } from './Multiname';
import { MethodInfo } from './MethodInfo';
import { Traits } from './Traits';
import { IndentingWriter } from '@awayfl/swf-loader';
import { CONSTANT } from './CONSTANT';
import { Namespace } from './Namespace';
import { ILocalInfo } from './ILocalInfo';

export class InstanceInfo extends Info implements ILocalInfo {
	public classInfo: ClassInfo = null;
	public runtimeTraits: RuntimeTraits = null;

	private _interfaces: Set<AXClass> = null;

	constructor(
		public readonly abc: ABCFile,
		public readonly multiname: Multiname,
		public readonly superName: Multiname,
		public readonly flags: number,
		public readonly protectedNs: Namespace,
		public readonly interfaceNames: Multiname [],
		public readonly methodInfo: MethodInfo,
		public readonly traits: Traits
	) {
		super(traits);
		this.methodInfo.instanceInfo = this;
		this.methodInfo.isConstructor = true;
	}

	public getClassName(): string {
		const namespace = this.multiname.namespaces[0];

		return namespace.uri ? namespace.uri + '.' + this.multiname.name : this.multiname.name;
	}

	public getInterfaces(ownerClass: AXClass): Set<AXClass> {
		if (this._interfaces) {
			return this._interfaces;
		}

		let superClassInterfaces;
		const superClass = ownerClass.superClass;
		if (superClass) {
			superClassInterfaces = superClass.classInfo.instanceInfo.getInterfaces(superClass);
		}
		const SetCtor: any = Set;
		const interfaces = this._interfaces = new SetCtor(superClassInterfaces);
		for (let i = 0; i < this.interfaceNames.length; i++) {
			const mn = this.interfaceNames[i];
			const type = this.abc.applicationDomain.getClass(mn);
			interfaces.add(type);
			const implementedInterfaces = type.classInfo.instanceInfo.getInterfaces(type);
			implementedInterfaces.forEach((iface) => interfaces.add(iface));
		}
		return interfaces;
	}

	public toString() {
		return 'InstanceInfo ' + this.multiname.name;
	}

	public trace(writer: IndentingWriter) {
		writer.enter('InstanceInfo: ' + this.multiname);
		this.superName && writer.writeLn('Super: ' + this.superName);
		this.traits.trace(writer);
		writer.outdent();
	}

	public isInterface(): boolean {
		return !!(this.flags & CONSTANT.ClassInterface);
	}

	public isSealed(): boolean {
		return !!(this.flags & CONSTANT.ClassSealed);
	}

	public isFinal(): boolean {
		return !!(this.flags & CONSTANT.ClassFinal);
	}
}