import { AXObject } from "../run/AXObject";
import { ASFunction } from "./ASFunction";
import { defineNonEnumerableProperty } from "@awayfl/swf-loader";
import { AXCallable } from "../run/AXCallable";
import { Errors } from "../errors";
import { sliceArguments } from "../run/writers";
import { ASArray } from "./ASArray";

export class ASMethodClosure extends ASFunction {
    static classInitializer() {
      var proto: any = this.dPrototype;
      var asProto: any = ASMethodClosure.prototype;
      defineNonEnumerableProperty(proto, '$Bgcall', asProto.call);
      defineNonEnumerableProperty(proto, '$Bgapply', asProto.apply);
    }

    private _value: AXCallable;

    static Create(receiver: AXObject, method: AXCallable) {
      var closure: ASMethodClosure = Object.create(this.sec.AXMethodClosure.tPrototype);

      closure._value = (<any>method);
      closure.methodInfo = method.methodInfo;
      
      closure.setReceiver(receiver);

      return closure;
    }
  
    setReceiver(r: any) {
      if(this.receiver === r) {
        return;
      }

      this.receiver = r;
      //@ts-ignore
      this.value = this._value.bind(r);
    }

    get prototype(): AXObject {
      return null;
    }
  
    set prototype(prototype: AXObject) {
      this.sec.throwError("ReferenceError", Errors.ConstWriteError, "prototype",
                                      "MethodClosure");
    }

    //@ts-ignore
    axCall(ignoredThisArg: any, arg1:any, arg2:any, arg3:any, arg4:any, arg5:any, arg6:any, arg7:any, arg8:any): any {
      //@ts-ignore
      return this.value(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
    }
  
    axApply(ignoredThisArg: any, argArray?: any[]): any {
      if(!argArray || argArray.length === 0) {
        //@ts-ignore
        this.value()
      }
      //@ts-ignore
      return this.value(argArray[0], argArray[1], argArray[2], argArray[3], argArray[4], argArray[5], argArray[6], argArray[7]);
    }
  
    //@ts-ignore
    call(ignoredThisArg: any, arg1:any, arg2:any, arg3:any, arg4:any, arg5:any, arg6:any, arg7:any, arg8:any) {
      //@ts-ignore
      return this.value(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
    }
  
    apply(ignoredThisArg: any, argArrayAS?: ASArray): any {
      const  argArray = argArrayAS ? argArrayAS.value : undefined;

      if(!argArray || argArray.length === 0) {
        //@ts-ignore
        this.value();
      }
      
      //@ts-ignore
      return this.value(argArray[0], argArray[1], argArray[2], argArray[3], argArray[4], argArray[5], argArray[6], argArray[7]);
    }
  }