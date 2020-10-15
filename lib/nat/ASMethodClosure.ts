import { AXObject } from '../run/AXObject';
import { ASFunction } from './ASFunction';
import { defineNonEnumerableProperty } from '@awayfl/swf-loader';
import { AXCallable } from '../run/AXCallable';
import { Errors } from '../errors';
import { sliceArguments } from '../run/writers';
import { ASArray } from './ASArray';

export class ASMethodClosure extends ASFunction {
	static classInitializer() {
		const proto: any = this.dPrototype;
		const asProto: any = ASMethodClosure.prototype;
		defineNonEnumerableProperty(proto, '$Bgcall', asProto.call);
		defineNonEnumerableProperty(proto, '$Bgapply', asProto.apply);
	}

	static Create(receiver: AXObject, method: AXCallable) {
		const closure: ASMethodClosure = Object.create(this.sec.AXMethodClosure.tPrototype);
		closure.receiver = <any>receiver;
		closure.value = method;
		closure.methodInfo = method.methodInfo;

		closure.axCall = closure.call;
		closure.axApply = closure.apply;

		return closure;
	}

	get prototype(): AXObject {
		return null;
	}

	set prototype(prototype: AXObject) {
		this.sec.throwError('ReferenceError', Errors.ConstWriteError, 'prototype',
			'MethodClosure');
	}

	axCall(ignoredThisArg: any): any {
		return this.value.apply(this.receiver, sliceArguments(arguments, 1));
	}

	axApply(ignoredThisArg: any, argArray?: any[]): any {
		return this.value.apply(this.receiver, argArray);
	}

	call(ignoredThisArg: any) {
		const args = arguments;
		const len = args.length;

		if (len <= 6) {
			return this.value.call(this.receiver, args[1], args[2], args[3], args[4], args[5]);
		} else {
			return this.value.apply(this.receiver, sliceArguments(arguments, 1));
		}
	}

	apply(ignoredThisArg: any, argArray?: any): any {
		return this.value.apply(this.receiver, (argArray && argArray.value) ? argArray.value : argArray);
	}
}