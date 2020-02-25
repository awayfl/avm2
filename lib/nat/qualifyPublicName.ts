import { isIndex } from "@awayfl/swf-loader";


export function qualifyPublicName(v: any) {
    return isIndex(v) ? v : '$Bg' + v;
  }