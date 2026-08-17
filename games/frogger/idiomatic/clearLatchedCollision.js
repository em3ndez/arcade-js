// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearLatchedCollision — collision-flag reset (guarded). If nothing is latched it returns; otherwise it clears
 * the collision latch and falls through to the cell-clearing helper.
 * LIVE-OUT: memory-only (both callers reload A / return right after).
 */
import { COLLISION_SUBFLAG, COLLISION_LATCH, FLY_SPRITE_X } from "./names.js";

export function clearLatchedCollision(m) {
  const { mem8 } = m;
  if (mem8[COLLISION_LATCH] === 0) return;
  mem8[COLLISION_SUBFLAG] = 0;
  return clearCollisionSpriteBlock(m);
}

// clearCollisionSpriteBlock — the cell-clearing helper clearLatchedCollision falls into and
// stampHomeGoalAndResetFrog dispatches: zero the four-byte fly/goal sprite block and the collision latch.
export function clearCollisionSpriteBlock(m) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = 0;
  mem8[(FLY_SPRITE_X + 1)] = 0;
  mem8[(FLY_SPRITE_X + 2)] = 0;
  mem8[(FLY_SPRITE_X + 3)] = 0;
  mem8[COLLISION_LATCH] = 0;
}
