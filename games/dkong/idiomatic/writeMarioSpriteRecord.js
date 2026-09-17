// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeMarioSpriteRecord — refresh Mario's 4-byte hardware sprite record from his live
 * position/sprite state. The convergence tail of the movement machine: every mover path
 * finishes here, copying Mario's state into the sprite shadow buffer the DMA blits each vblank.
 *
 * The reads are in RECORD field order (X, code, attr, Y), which is not the sources' memory
 * order; the four destinations are distinct so the result is order-independent either way.
 *
 * LIVE-OUT: memory-only — the four record bytes.
 */

import {
  MARIO_X, MARIO_Y, MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR, MARIO_SPRITE_RECORD,
} from "./names.js";

export function writeMarioSpriteRecord(m) {
  const { mem8 } = m;
  mem8[MARIO_SPRITE_RECORD + 0] = mem8[MARIO_X];
  mem8[MARIO_SPRITE_RECORD + 1] = mem8[MARIO_SPRITE_CODE];
  mem8[MARIO_SPRITE_RECORD + 2] = mem8[MARIO_SPRITE_ATTR];
  mem8[MARIO_SPRITE_RECORD + 3] = mem8[MARIO_Y];
}
