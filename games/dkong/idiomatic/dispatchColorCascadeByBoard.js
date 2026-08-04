// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchColorCascadeByBoard — the per-frame colour-cascade dispatcher: route by the current
 * board into one of the colour-cycle arms.
 *
 * It reads the current board and splits three ways on its low two bits:
 *
 *   - board bit 0 CLEAR (the even boards, 50m and 100m) -> the even-board arm, which shifts the
 *     sprite-object block's X column by a board-specific delta and then falls into the colour-
 *     cycle repaint.
 *   - board bit 0 SET, bit 1 SET (75m)                  -> straight into the colour-cycle repaint,
 *     with no sprite shift at all.
 *   - board bit 0 SET, bit 1 CLEAR (25m)                -> first nudge the sprite-object block's
 *     Y column up 4 pixels — the whole ten-record row at once — then the colour-cycle repaint.
 *
 * So the odd boards share the repaint and 25m alone gets the extra per-frame Y-column nudge
 * before it. The nudge goes through the shared column-add, which adds one signed delta into the
 * same field of every record in the block. This routine writes no memory of its own; the visible
 * sprite and colour writes all happen in the arms.
 *
 * Only the 25m arm has to stage anything: that callee still takes its field pointer and signed
 * delta in registers, so they are loaded here. The other two arms read what they need out of
 * memory (the board and the sweep counter) and take no arguments.
 *
 * LIVE-OUT: memory-only — the sprite-object Y column on 25m, plus whatever the colour-cycle arms
 * paint.
 */

import { BOARD, SPRITE_OBJ_BLOCK, SPRITE_Y } from "./names.js";
import { shiftEvenBoardSpriteColumn } from "./shiftEvenBoardSpriteColumn.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js";

const BOARD_BIT0 = 0x01; // low bit: clear on the even boards (50m/100m), set on 25m/75m
const BOARD_BIT1 = 0x02; // next bit: distinguishes 75m (set) from 25m (clear) among the odd boards
const Y_SHIFT = 0xfc;    // signed byte −4: the 25m per-frame nudge of the sprite-object Y column

export function dispatchColorCascadeByBoard(m) {
  const { regs, mem } = m;

  const board = mem.read8(BOARD);

  // Even board (50m/100m): the X-shift + colour-cycle arm.
  if ((board & BOARD_BIT0) === 0) {
    shiftEvenBoardSpriteColumn(m);
    return;
  }

  // Odd board, bit 1 clear (25m): nudge the whole sprite-object Y column up 4px before the
  // colour-cycle repaint. 75m (bit 1 set) skips the nudge and falls straight through.
  if ((board & BOARD_BIT1) === 0) {
    regs.hl = SPRITE_OBJ_BLOCK + SPRITE_Y; // the Y field of the first of the ten sprite-object records
    regs.c = Y_SHIFT;
    addToSpriteObjectColumn(m);
  }

  // Both odd boards converge on the per-frame colour-cycle repaint.
  dispatchColorCyclePaint(m);
}
