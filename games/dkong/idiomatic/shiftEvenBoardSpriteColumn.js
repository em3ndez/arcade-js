// SPDX-License-Identifier: GPL-3.0-only
/**
 * shiftEvenBoardSpriteColumn — shift the sprite-object block's X column by a board-specific
 * delta, then run the per-frame colour-cycle repaint.  ROM 0x0478.
 *
 * The even-board arm of the per-frame colour cascade: the dispatcher
 * (dispatchColorCascadeByBoard) routes here when the current board's low bit is clear — the
 * 50m and 100m boards. It nudges the whole sprite-object row horizontally by an amount that
 * depends on which of those boards is active, then falls into the colour-cycle repaint:
 *
 *   - 50m (board bit 1 SET)   -> the shift comes from M50_OBJ_ROW_SHIFT, the RAM byte staged
 *     for this board.
 *   - the other even board     -> the fixed shift +0x44.
 *
 * The chosen delta is added into the X field of all ten sprite-object records through
 * addToSpriteObjectColumn (the rst-0x38 vector), repositioning the row with one number.
 * Control then continues into dispatchColorCyclePaint, the per-frame colour-cycle
 * repaint, which takes its own inputs (the board and the sweep counter) from RAM.
 *
 * REGISTER-ABI MARSHALLING (dissolves once addToSpriteObjectColumn takes honest args):
 * that callee still reads its field pointer and signed delta from registers, so this
 * routine loads exactly what the oracle's rst-0x38 site loads — the sprite-object block
 * base as the field pointer and the delta. dispatchColorCyclePaint reads no register
 * input (it takes the board and sweep counter from RAM), so it is a bare call.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0478.test.js.
 * GATE:     crafted-entry — 0x0478 is COLD in a 25m attract (the dispatcher only routes
 *           here on an even board), so there are no natural captures. Validated on
 *           crafted entries reposed on a real attract base: BOARD == 2 (bit-1-set arm,
 *           delta from M50_OBJ_ROW_SHIFT) and BOARD == 4 (bit-1-clear arm, default +0x44), each with
 *           the incoming board-rotated byte set to match the oracle's register read, plus
 *           an M50_OBJ_ROW_SHIFT-varied entry proving the RAM delta is really read. Whole contract
 *           each time: RAM − STACK_SCRATCH + pc + SP; the candidate models its one net
 *           return with a single m.ret(). Teeth: an always-default-delta twin (caught on
 *           BOARD == 2) and a wrong-column twin (field pointer at the Y column, caught on
 *           the sprite-object X bytes).
 * LIVE-OUT: memory-only — the sprite-object X column (ten stride-4 bytes) plus whatever
 *           the colour-cycle arms paint. The cascade returns up to a caller that reads no
 *           register before overwriting it, so the oracle's residual registers/flags are
 *           dead ABI. SP/PC are the single net return the JS call stack replaces (the
 *           harness supplies one m.ret()).
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908), BOARD (0x6227), and the 50m shift-delta source
 *           M50_OBJ_ROW_SHIFT (0x63b7) — all from ram.js (0x63b7 named this pass; it is the 50m
 *           sprite-object row X-shift delta, staged by entry_03fb/entry_0400). The default shift
 *           and the board-bit mask are immediates.
 */

import { SPRITE_OBJ_BLOCK, BOARD, M50_OBJ_ROW_SHIFT } from "./ram.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js"; // ROM 0x0486

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
