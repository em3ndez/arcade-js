// SPDX-License-Identifier: GPL-3.0-only
/**
 * armHomeGoalSprite — arm a four-cell block with the caller's lead byte plus a fixed tail.
 * LIVE-OUT: memory-only.
 */
import { FLY_SPRITE_X, loc_8340 } from "./names.js";

const TAIL = [25, 3, 16];
const ARM_VALUE = 160;

export function armHomeGoalSprite(m, leadByte = m.regs.b) {
  const { mem8 } = m;
  mem8[FLY_SPRITE_X] = leadByte;
  mem8[(FLY_SPRITE_X + 1) & 0xffff] = TAIL[0];
  mem8[(FLY_SPRITE_X + 2) & 0xffff] = TAIL[1];
  mem8[(FLY_SPRITE_X + 3) & 0xffff] = TAIL[2];
  mem8[loc_8340] = ARM_VALUE;
}
