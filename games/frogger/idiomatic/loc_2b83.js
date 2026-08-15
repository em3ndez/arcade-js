// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b83 — sprite-object dispatcher: run the five IX/IY sprite-object arms in fixed order
 * (spawn, steer, write-X slot, hit-test, write-attr slot). LIVE-OUT: memory-only.
 */
import { spawnSpriteObject } from "./spawnSpriteObject.js";
import { steerSpriteObjectTowardTarget } from "./steerSpriteObjectTowardTarget.js";
import { writeSpriteObjectSlotX } from "./writeSpriteObjectSlotX.js";
import { flagSpriteObjectFrogHitAhead } from "./flagSpriteObjectFrogHitAhead.js";
import { writeSpriteObjectSlotAttr } from "./writeSpriteObjectSlotAttr.js";

export function loc_2b83(m) {
  spawnSpriteObject(m);
  steerSpriteObjectTowardTarget(m);
  writeSpriteObjectSlotX(m);
  flagSpriteObjectFrogHitAhead(m);
  return writeSpriteObjectSlotAttr(m);
}
