// SPDX-License-Identifier: GPL-3.0-only
/**
 * armHomeGoalSprite — arm a four-cell block with the caller's lead byte plus a fixed tail.
 * LIVE-OUT: memory-only.
 */
import { FLY_SPRITE_X, HOME_GOAL_SPRITE_ARM_CELL } from "./names.js";

const TAIL = [25, 3, 16];
const ARM_VALUE = 160;

export function armHomeGoalSprite(m, leadByte = m.regs.b) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = leadByte;
  mem8[(FLY_SPRITE_X + 1) & 0xffff] = TAIL[0];
  mem8[(FLY_SPRITE_X + 2) & 0xffff] = TAIL[1];
  mem8[(FLY_SPRITE_X + 3) & 0xffff] = TAIL[2];
  mem8[HOME_GOAL_SPRITE_ARM_CELL] = ARM_VALUE;
}
