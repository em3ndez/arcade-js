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

export function dispatchSpriteObjectArmsA(m) {
  spawnSpriteObjectArmA(m);
  animateSpriteObjectFrame(m);
  loc_29f9(m);
  placeSpriteObjectSlotAndRetire(m);
  return flagSpriteObjectFrogHit(m);
}
