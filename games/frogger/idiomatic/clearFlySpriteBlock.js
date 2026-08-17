// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearFlySpriteBlock — zero the four-byte fly/goal sprite block (FLY_SPRITE_X..+3). The sibling of
 * clearCollisionSpriteBlock without the collision-latch write; the collision orchestrator's timing arm
 * runs it when the goal-sprite arm counter drains.
 * LIVE-OUT: memory-only; the leftover HL (block end) is dead at the call site, not read.
 */
import { FLY_SPRITE_X } from "./names.js";

export function clearFlySpriteBlock(m) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = 0;
  mem8[(FLY_SPRITE_X + 1)] = 0;
  mem8[(FLY_SPRITE_X + 2)] = 0;
  mem8[(FLY_SPRITE_X + 3)] = 0;
}
