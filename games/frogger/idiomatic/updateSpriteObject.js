// SPDX-License-Identifier: GPL-3.0-only
/**
 * updateSpriteObject — sprite-object dispatcher: run the five IX/IY sprite-object arms in fixed order
 * (spawn, steer, write-X slot, hit-test, write-attr slot). LIVE-OUT: memory-only.
 */
import { spawnSpriteObject } from "./spawnSpriteObject.js";
import { steerSpriteObjectTowardTarget } from "./steerSpriteObjectTowardTarget.js";
import { writeSpriteObjectSlotX } from "./writeSpriteObjectSlotX.js";
import { flagSpriteObjectFrogHitAhead } from "./flagSpriteObjectFrogHitAhead.js";
import { writeSpriteObjectSlotAttr } from "./writeSpriteObjectSlotAttr.js";

export function updateSpriteObject(m, ix = m.regs.ix, iy = m.regs.iy) {
  spawnSpriteObject(m, ix, iy);
  steerSpriteObjectTowardTarget(m, ix, iy);
  writeSpriteObjectSlotX(m, ix, iy);
  flagSpriteObjectFrogHitAhead(m, ix, iy);
  return writeSpriteObjectSlotAttr(m, ix, iy);
}
