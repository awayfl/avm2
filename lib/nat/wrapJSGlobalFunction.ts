import { jsGlobal } from "@awayjs/swf-viewer";

export function wrapJSGlobalFunction(fun) {
    return function(sec, ...args) {
      return fun.apply(jsGlobal, args);
    };
  }
  