// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceInterludeStepAndLiftKongFigure — step the board-advance sequence on, and on the 25m
 * board only, raise the whole staged sprite-object block by 4 pixels.
 *
 * The shared tail two of the board-cleared interlude's step handlers end in. It does two things:
 *
 *   1. BOARD_ADVANCE_STEP is incremented, unconditionally, so the interlude moves on to its next
 *      step whichever board is being played.
 *   2. A per-board gate is then asked whether the current board is the 25m girder board. On any
 *      other board that is the end of it. On 25m, 4 is subtracted from the Y byte of all ten
 *      sprite-object records at once — a strided walk over the block, four bytes apart. A
 *      smaller Y is higher up the screen, so the whole staged figure rises 4 pixels.
 *
 * The subtraction is 8-bit and wraps, and it touches only the Y column: the X, sprite code and
 * attribute of every record are left exactly as staged.
 *
 * LIVE-OUT: memory-only — the incremented sequence step, and on 25m the ten Y bytes.
 */

import { boardBitGate } from "./boardBitGate.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

export function advanceInterludeStepAndLiftKongFigure(m) {
  const { regs, mem } = m;

  // Step the sequence on. This happens on every board.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);

  // Ask the board gate whether this is the 25m board — bit 0 of the board mask. A false
  // answer means some other board, and the lift below is skipped.
  regs.a = 0x01;
  if (!boardBitGate(m)) return;

  // Subtract 4 from the Y byte of each of the ten sprite-object records: the count and the
  // 4-byte stride are fixed, and the addend is -4 taken 8-bit, so the block rises 4 pixels.
  regs.hl = SPRITE_OBJ_BLOCK + 3;
  regs.c = 0xfc;
  addToSpriteObjectColumn(m);
}
