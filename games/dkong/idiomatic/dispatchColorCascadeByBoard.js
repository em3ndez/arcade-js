// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchColorCascadeByBoard — the per-frame colour-cascade dispatcher: route by the current
 * board into one of the colour-cycle arms.  ROM 0x0450.
 *
 * Head of the colour-cycle family (its arms are shiftEvenBoardSpriteColumn and the English-named
 * dispatchColorCyclePaint). Reached every colour-cycle beat (the advanceColorCycleSweep / resetColorCycleSweep
 * sites rejoin here). It reads the current board (BOARD) and splits three ways on its low two bits:
 *
 *   - board bit 0 CLEAR (the even boards, 50m and 100m) -> shiftEvenBoardSpriteColumn, which shifts
 *     the sprite-object block's X column by a board-specific delta and then falls into the
 *     colour-cycle repaint.
 *   - board bit 0 SET, bit 1 SET (75m)                  -> straight into dispatchColorCyclePaint,
 *     the colour-cycle repaint, with no sprite shift.
 *   - board bit 0 SET, bit 1 CLEAR (25m)                -> first nudge the sprite-object block's
 *     Y column up 4px (the whole ten-record row), then fall into dispatchColorCyclePaint.
 *
 * So the odd boards share the colour-cycle repaint; 25m alone gets the extra per-frame Y-column
 * nudge before it. The Y nudge is applied to all ten sprite-object records at once through
 * addToSpriteObjectColumn (the rst-0x38 vector), which adds the signed delta into one field of
 * every record. This routine writes no RAM of its own — the arms do the visible sprite and
 * colour-RAM writes.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): reads BOARD and routes 3-way into
 * shiftEvenBoardSpriteColumn + the English-named sibling dispatchColorCyclePaint — the head of the
 * named colour-cycle family (all arms rest on named BOARD / SPRITE_OBJ_BLOCK / COLOUR_CYCLE_ACTIVE).
 *
 * REGISTER-ABI MARSHALLING (dissolves once addToSpriteObjectColumn takes honest args): only the
 * 25m arm marshals — that callee still reads its field pointer and signed delta from registers,
 * so this routine loads exactly what the oracle's rst-0x38 site loads: the sprite-object block's
 * Y field as the pointer and the −4 delta. shiftEvenBoardSpriteColumn and dispatchColorCyclePaint
 * read their own inputs from RAM (the board and the sweep counter), so both are bare calls.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0450.test.js.
 * GATE:     crafted-entry (+ a few real captures). 0x0450 is dispatched on 25m in attract
 *           (BOARD == 1 -> the Y-shift + colour-cycle arm), so a handful of natural captures
 *           cover that path; crafted entries reposed on a real attract base then drive the even
 *           arm (BOARD == 2 and 4 -> shiftEvenBoardSpriteColumn) and the 75m direct arm (BOARD == 3 -> straight to
 *           dispatchColorCyclePaint). Whole contract each time: RAM − STACK_SCRATCH + pc + SP;
 *           the candidate models its one net return with a single m.ret(). Teeth: an inverted
 *           even/odd dispatch, a dropped 25m Y-shift, and a wrong Y-shift delta.
 * LIVE-OUT: memory-only — the sprite-object Y column (on 25m) plus whatever the colour-cycle
 *           arms paint. The cascade returns up to a caller that reads no register before
 *           overwriting it, so the oracle's residual board-rotated value and flags are dead ABI.
 *           SP/PC are the single net return the JS call stack replaces (the harness supplies one
 *           m.ret()).
 * NAMES:    BOARD (0x6227), SPRITE_OBJ_BLOCK (0x6908) with the SPRITE_Y field offset — all from
 *           names.js. The −4 shift delta is an immediate. This routine touches no unnamed RAM.
 */

import { BOARD, SPRITE_OBJ_BLOCK, SPRITE_Y } from "./names.js";
import { shiftEvenBoardSpriteColumn } from "./shiftEvenBoardSpriteColumn.js"; // ROM 0x0478 — the even-board arm
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js"; // ROM 0x0486

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
    regs.hl = SPRITE_OBJ_BLOCK + SPRITE_Y; // the Y field (0x690b) of the ten sprite-object records
    regs.c = Y_SHIFT;
    addToSpriteObjectColumn(m);
  }

  // Both odd boards converge on the per-frame colour-cycle repaint.
  dispatchColorCyclePaint(m);
}
