import { jsGlobal } from "@awayfl/swf-loader";

export function wrapJSGlobalFunction(fun) {
    return function(sec, ...args) {
      return fun.apply(jsGlobal, args);
    };
  }
  