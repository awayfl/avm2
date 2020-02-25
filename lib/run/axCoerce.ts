import { isNullOrUndefined } from "@awayfl/swf-loader";
import { Errors } from "../errors";

export function axCoerce(x: any) {
    if (isNullOrUndefined(x)) {
      return null;
    } 
    if (!this.axIsType(x)) {
      this.sec.throwError('TypeError', Errors.CheckTypeFailedError, x,
                                      this.classInfo.instanceInfo.getClassName());
    }
    return x;
  }