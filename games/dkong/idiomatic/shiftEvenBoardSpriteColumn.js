// SPDX-License-Identifier: GPL-3.0-only
/**
 * shiftEvenBoardSpriteColumn — shift the sprite-object block's X column by a board-specific
 * delta, then run the per-frame colour-cycle repaint.
 *
 * The even-board arm of the per-frame colour cascade: it is reached when the current board's
 * low bit is clear — the 50m and 100m boards. It nudges the whole sprite-object row
 * horizontally by an amount that depends on which of those boards is active, then continues
 * into the colour-cycle repaint:
 *
 *   - 50m (board bit 1 SET)   -> the shift comes from M50_OBJ_ROW_SHIFT, the RAM byte staged
 *     for this board.
 *   - the other even board     -> the fixed shift +0x44.
 *
 * The chosen delta is added into the X field of all ten sprite-object records by the shared
 * strided-column adder, repositioning the whole row with one number. Control then continues
 * into the per-frame colour-cycle repaint, which takes its own inputs (the board and the
 * sweep counter) from RAM.
 *
 * LIVE-OUT: memory-only — the sprite-object X column (ten stride-4 bytes) plus whatever the
 * colour-cycle arms paint. The column adder reads its field pointer and signed delta from
 * registers, so those are set here before the hand-off.
 */

import { SPRITE_OBJ_BLOCK, BOARD, M50_OBJ_ROW_SHIFT } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";

const DEFAULT_SHIFT = 0x44;        // the fixed X-shift (+68) on the other even board (100m)
const BOARD_BIT1 = 0x02;           // board bit 1: set on 50m, clear on 100m

export function shiftEvenBoardSpriteColumn(m) {
  const { regs, mem } = m;

  // Which even board this is selects the horizontal shift: 50m (board bit 1 set) takes it
  // from RAM; every other even board uses the fixed +0x44.
  const board = mem.read8(BOARD);
  const shiftX = (board & BOARD_BIT1) !== 0 ? mem.read8(M50_OBJ_ROW_SHIFT) : DEFAULT_SHIFT;

  // Add the shift into the X field of all ten sprite-object records.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = shiftX;
  addToSpriteObjectColumn(m);

  // Continue into the per-frame colour-cycle repaint.
  dispatchColorCyclePaint(m);
}
