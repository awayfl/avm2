import { AXObject } from "../run/AXObject";
import { assert } from "@awayjs/graphics";
import { defineNonEnumerableProperty, release } from "@awayfl/swf-loader";


export function addPrototypeFunctionAlias(object: AXObject, name: string, fun: Function) {
    release || assert(name.indexOf('$Bg') === 0);
    release || assert(typeof fun === 'function');
    // REDUX: remove the need to box the function.
    defineNonEnumerableProperty(object, name, object.sec.AXFunction.axBox(fun));
  }