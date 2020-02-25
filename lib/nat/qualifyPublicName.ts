import { isIndex } from "@awayjs/swf-viewer";


export function qualifyPublicName(v: any) {
    return isIndex(v) ? v : '$Bg' + v;
  }