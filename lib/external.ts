// choose your destiny! (mk)
// box2D v6
// Cave Chaos, Flipside

import B2D_LEGACY from "./Box2Dold";

// box2D unknown  =)
// Cave Chaos 2
import B2D from "./Box2D";

let sayHello = true;
export const enum PREF_BOX2D_VERSION {
  NONE = "none",
  LEGACY = "legacy",
  NEW = "new",
  CUSTOM = "custom",
}

const B2D_MAPPING = {
  [PREF_BOX2D_VERSION.NEW]: B2D,
  [PREF_BOX2D_VERSION.LEGACY]: B2D_LEGACY,
  [PREF_BOX2D_VERSION.NONE]: null,
};

export const BOX2D_PREFERENCE = {
  /**
   * Prefered version of Box2D
   */
  version: PREF_BOX2D_VERSION.NONE,
  custom: undefined,
  /**
   * Return prefered runtime of Box2D or empty object, if nothing was prefered
   */
  get prefer() {
	if(sayHello) {
		console.debug('B2D Version - ', this.version);
		sayHello = false;
	}

    if (this.version === PREF_BOX2D_VERSION.CUSTOM) {
      if (!this.custom)
        throw new Error("Custom Box2D should be assigned to `custom` field");

      return this.custom;
    }

    if (B2D_MAPPING[this.version]) {
      return B2D_MAPPING[this.version];
    }

    // return mapping to NONE
    return B2D_MAPPING[PREF_BOX2D_VERSION.NONE];
  },
};
