// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeMarioSpriteRecord — refresh Mario's 4-byte hardware sprite record from his
 * live position/sprite state.  ROM 0x1DA6.
 *
 * The convergence tail of the movement machine (dispatchMarioMovement): every path through the
 * Z80 mover — grounded, airborne, climbing, hammer, landed — finishes by tail-jumping
 * here (11 `jp 0x1da6` / `call 0x1da6` sites), so this is the single spot that copies
 * Mario's just-computed state into the sprite shadow buffer the DMA blits to hardware
 * sprite RAM each vblank.
 *
 * It writes MARIO_SPRITE_RECORD (0x694C), Mario's 4-byte record inside SPRITE_BUFFER,
 * from four separate live fields — in the record's field order [X, code, attr, Y],
 * which is NOT the source-address order (Y at 0x6205 comes before code/attr at
 * 0x6207/0x6208), so the reads are deliberately out of order and must not be sorted:
 *
 *   record +0 (0x694C) <- MARIO_X          (0x6203)
 *   record +1 (0x694D) <- MARIO_SPRITE_CODE (0x6207)   // tile + facing-flip bit 7
 *   record +2 (0x694E) <- MARIO_SPRITE_ATTR (0x6208)   // colour/bank/flip attribute
 *   record +3 (0x694F) <- MARIO_Y          (0x6205)
 *
 * The four destinations are distinct, so the final memory is order-independent; the
 * ROM's write order is kept anyway. A LEAF: reads/writes only these bytes, calls
 * nothing. The player-hardcoded twin of the generic object-record copy loc_21ba.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1da6.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (the mover's tail fires
 *           every frame Mario is processed on 25m) cover the single straight-line arm;
 *           crafted entries vary each source byte independently to pin the exact
 *           field-to-slot mapping. Teeth: a sorted-source copy (the exact mis-order the
 *           oracle warns against) and a dropped-Y copy, both caught.
 * LIVE-OUT: memory-only — the four record bytes at 0x694C..0x694F. Every caller reaches
 *           here by an unconditional tail-jump and the routine's `ret` is unconditional,
 *           so no successor reads a flag it sets; the oracle's residual A (= MARIO_Y),
 *           HL (= 0x694F) and flags are dead ABI (pc/SP model the single return).
 * NAMES:    MARIO_X (0x6203), MARIO_SPRITE_CODE (0x6207), MARIO_SPRITE_ATTR (0x6208),
 *           MARIO_Y (0x6205), MARIO_SPRITE_RECORD (0x694C) — all from names.js.
 */

import {
  MARIO_X, MARIO_Y, MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR, MARIO_SPRITE_RECORD,
} from "./names.js";

export function writeMarioSpriteRecord(m) {
  const { mem } = m;
  mem.write8(MARIO_SPRITE_RECORD + 0, mem.read8(MARIO_X));           // 0x694C <- 0x6203
  mem.write8(MARIO_SPRITE_RECORD + 1, mem.read8(MARIO_SPRITE_CODE)); // 0x694D <- 0x6207
  mem.write8(MARIO_SPRITE_RECORD + 2, mem.read8(MARIO_SPRITE_ATTR)); // 0x694E <- 0x6208
  mem.write8(MARIO_SPRITE_RECORD + 3, mem.read8(MARIO_Y));           // 0x694F <- 0x6205
}
