import { isNullOrUndefined } from "@awayfl/swf-loader";
import { Errors } from "../errors";

export function axCoerce(x: any) {
    if (isNullOrUndefined(x)) {
      return null;
    } 

    if (x.__fast__) {
      return x;
    }

    // propagate fast mode for arrays with fast entries
    if ( Array.isArray(x) && x.length && x[0].__fast__) {
      return x;
    }

    if (!this.axIsType(x)) {
      this.sec.throwError('TypeError', Errors.CheckTypeFailedError, x,
                                      this.classInfo.instanceInfo.getClassName());
    }
    return x;
  }