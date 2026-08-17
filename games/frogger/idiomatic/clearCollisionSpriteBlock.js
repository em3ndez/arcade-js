// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearCollisionSpriteBlock — zero the four-byte fly/goal sprite block (FLY_SPRITE_X..+3) and the
 * collision latch. clearLatchedCollision falls into it after clearing the sub-flag, and
 * stampHomeGoalAndResetFrog dispatches it after a latched hit is scored.
 * LIVE-OUT: memory-only.
 */
import { FLY_SPRITE_X, COLLISION_LATCH } from "./names.js";

export function clearCollisionSpriteBlock(m) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = 0;
  mem8[(FLY_SPRITE_X + 1)] = 0;
  mem8[(FLY_SPRITE_X + 2)] = 0;
  mem8[(FLY_SPRITE_X + 3)] = 0;
  mem8[COLLISION_LATCH] = 0;
}
