// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchSpriteObjectArmsA — sprite-object dispatcher A. Runs the five IX/IY per-slot arms in fixed
 * order (spawn, animate frame, motion, place slot, hit-test) against the current record/slot, then
 * returns. Each arm is a lifted sibling, called inline. LIVE-OUT: memory-only.
 */
import { spawnSpriteObjectArmA } from "./spawnSpriteObjectArmA.js";
import { animateSpriteObjectFrame } from "./animateSpriteObjectFrame.js";
import { loc_29f9 } from "./loc_29f9.js";
import { placeSpriteObjectSlotAndRetire } from "./placeSpriteObjectSlotAndRetire.js";
import { flagSpriteObjectFrogHit } from "./flagSpriteObjectFrogHit.js";

export function dispatchSpriteObjectArmsA(m, ix = m.regs.ix, iy = m.regs.iy) {
  spawnSpriteObjectArmA(m, ix, iy);
  animateSpriteObjectFrame(m, ix, iy);
  loc_29f9(m, ix, iy);
  placeSpriteObjectSlotAndRetire(m, ix, iy);
  return flagSpriteObjectFrogHit(m, ix, iy);
}
