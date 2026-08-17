// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearLatchedCollision — collision-flag reset (guarded). If nothing is latched it returns; otherwise it clears
 * the collision latch and falls through to the cell-clearing helper.
 * LIVE-OUT: memory-only (both callers reload A / return right after).
 */
import { COLLISION_SUBFLAG, COLLISION_LATCH } from "./names.js";
import { clearCollisionSpriteBlock } from "./clearCollisionSpriteBlock.js";

export function clearLatchedCollision(m) {
  const { mem8 } = m;
  if (mem8[COLLISION_LATCH] === 0) return;
  mem8[COLLISION_SUBFLAG] = 0;
  return clearCollisionSpriteBlock(m);
}
