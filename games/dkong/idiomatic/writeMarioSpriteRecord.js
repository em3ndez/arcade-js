// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeMarioSpriteRecord — refresh Mario's 4-byte hardware sprite record from his live
 * position/sprite state.
 *
 * The convergence tail of the movement machine: every path through the mover — grounded,
 * airborne, climbing, hammer, landed — finishes here, so this is the single spot that copies
 * Mario's just-computed state into the sprite shadow buffer the DMA blits to hardware sprite RAM
 * each vblank.
 *
 * It fills MARIO_SPRITE_RECORD, Mario's 4-byte record inside SPRITE_BUFFER, from four separate
 * live fields, in the RECORD's field order:
 *
 *   record +0 <- MARIO_X
 *   record +1 <- MARIO_SPRITE_CODE   // tile + facing-flip bit 7
 *   record +2 <- MARIO_SPRITE_ATTR   // colour/bank/flip attribute
 *   record +3 <- MARIO_Y
 *
 * That is NOT the order the sources sit at in memory — Mario's Y byte comes before his sprite
 * code and attribute — so the reads are deliberately out of source order and must not be sorted.
 * The four destinations are distinct, so the resulting memory is order-independent either way.
 *
 * A LEAF: reads and writes only these bytes, and calls nothing.
 *
 * LIVE-OUT: memory-only — the four record bytes. Every caller reaches here by an unconditional
 * tail-jump and this routine's return is unconditional, so no successor reads a flag it sets.
 */

import {
  MARIO_X, MARIO_Y, MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR, MARIO_SPRITE_RECORD,
} from "./names.js";

export function writeMarioSpriteRecord(m) {
  const { mem } = m;
  mem.write8(MARIO_SPRITE_RECORD + 0, mem.read8(MARIO_X));
  mem.write8(MARIO_SPRITE_RECORD + 1, mem.read8(MARIO_SPRITE_CODE));
  mem.write8(MARIO_SPRITE_RECORD + 2, mem.read8(MARIO_SPRITE_ATTR));
  mem.write8(MARIO_SPRITE_RECORD + 3, mem.read8(MARIO_Y));
}
