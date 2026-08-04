// SPDX-License-Identifier: GPL-3.0-only
/**
 * slide50mSpriteRowAndServiceColorCycle — the per-frame colour-cycle driver entry, with a 50m-only sprite-object
 * row X-shift preamble in front of it.  ROM 0x03FB.
 *
 * Called once per frame from the attract/colour driver (loc_197a @0x19B0). It first
 * looks at the current board:
 *
 *   - Any board but 50m (BOARD != 2): nothing special — hand straight off to
 *     serviceColorCycle, which advances the running sweep, re-arms one at the
 *     frame-counter wrap, or just repaints the colour column.
 *   - 50m (BOARD == 2): run the 50m sprite-object-row preamble first, THEN service
 *     the colour cycle. The preamble does two things, in order:
 *       1. Shift the X column of all ten sprite-object records (SPRITE_OBJ_BLOCK,
 *          0x6908–0x692F) by the 50m object-1 published step (M50_OBJ1_STEP), moving
 *          the whole row of 50m props by that signed delta.
 *       2. Take the (now-shifted) X byte of the third sprite-object record (0x6910),
 *          subtract 0x3b, and store the result as M50_OBJ_ROW_SHIFT — the X-shift
 *          delta the 50m column painter (shiftEvenBoardSpriteColumn, ROM 0x0478)
 *          later adds into the sprite-object X column.
 *
 * This is the same body its sibling entry_0400 runs; the two differ only in how they
 * reach the colour-cycle tail (this one on BOARD == 2, entry_0400 on its task-runner's
 * live-in flag). Every colour/sprite write beyond the one M50_OBJ_ROW_SHIFT store
 * happens inside the callees.
 *
 * REGISTER-ABI MARSHALLING (dissolves once addToSpriteObjectColumn takes honest args):
 * that callee still reads its field pointer and delta from registers, so this routine
 * loads exactly what the oracle's rst-0x38 site loads — the field pointer at
 * SPRITE_OBJ_BLOCK and the signed delta from M50_OBJ1_STEP. serviceColorCycle reads
 * its inputs straight from RAM, so it is a bare direct call.
 *
 * NAME: promoted from loc_03fb. Both live-outs are measured, not read off this body:
 * names.js grounds M50_OBJ1_STEP live as {0,1,255} (0 on even frames, ±1 on odd, sign
 * following the direction latch) and M50_OBJ_ROW_SHIFT live on the board-2 arm with
 * 1996 frame-to-frame transitions over a 3994-frame gameplay window, explicitly "an
 * X-shift, NOT a colour delta". The name deliberately does NOT say what the ten
 * sprite-objects depict: the 0x385C template loc_0d5f stamps into 0x6908 is the same on
 * every board, so it carries no per-board identity, and the repo's own "Kong on 50m"
 * reading rests on a screenshot (begin50mKongRecaptureInterlude.js says so in plain
 * text), which is below the routine-name bar.
 *
 * Memory-equivalent to the frozen oracle — equivalence-03fb.test.js.
 * GATE:     capture/clone/replay of real attract dispatches (all BOARD == 1, so the
 *           natural path is the BOARD != 2 colour-cycle hand-off, ~1197 in 2000 frames)
 *           + crafted entries that force the cold BOARD == 2 preamble (varying the
 *           object-1 step and the read-back X byte, an 8-bit shift/subtract wrap) and
 *           each colour-cycle route (active / repaint / start-of-sweep) both with and
 *           without the preamble. Whole contract each time: RAM − STACK_SCRATCH + pc +
 *           SP; the candidate models its one net return with a single m.ret(). Teeth:
 *           a preamble-on-wrong-board twin, a dropped M50_OBJ_ROW_SHIFT store, and a
 *           wrong subtract constant.
 * LIVE-OUT: memory-only — the caller tail-services the colour cycle and reads no
 *           register afterwards, so the oracle's residual registers/flags are dead ABI.
 *           SP/PC are the single net return the JS call stack replaces (the harness
 *           supplies one m.ret()).
 * NAMES:    BOARD (0x6227), SPRITE_OBJ_BLOCK (0x6908), M50_OBJ1_STEP (0x63A3),
 *           M50_OBJ_ROW_SHIFT (0x63B7) — all from names.js. The third sprite-object X
 *           byte (0x6910) is record 2's X field inside the named SPRITE_OBJ_BLOCK span,
 *           reached as SPRITE_OBJ_BLOCK + 8 (the same field begin50mKongRecaptureInterlude reaches as
 *           SPRITE_OBJ_BLOCK + 0x08); no distinct cross-reader role, so no dedicated cell.
 */

import { BOARD, SPRITE_OBJ_BLOCK, M50_OBJ1_STEP, M50_OBJ_ROW_SHIFT } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { serviceColorCycle } from "./serviceColorCycle.js"; // ROM 0x0413

// Record 2's X byte in the SPRITE_OBJ_BLOCK span, read back after the row shift
// (0x6908 + 2*4 = 0x6910). The same field begin50mKongRecaptureInterlude reaches as SPRITE_OBJ_BLOCK + 0x08.
const SPRITE_OBJ_REC2_X = SPRITE_OBJ_BLOCK + 8;

export function slide50mSpriteRowAndServiceColorCycle(m) {
  const { regs, mem } = m;

  // Not 50m: no preamble, just drive the colour cycle.
  if (mem.read8(BOARD) !== 2) {
    serviceColorCycle(m);
    return;
  }

  // 50m preamble. Shift the X column of all ten sprite-object records by the 50m
  // object-1 step. addToSpriteObjectColumn reads the field pointer from regs.hl and
  // the signed delta from regs.c.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = mem.read8(M50_OBJ1_STEP);
  addToSpriteObjectColumn(m);

  // Row-shift delta = the (shifted) third record's X byte less 0x3b (8-bit; the store
  // truncates). Consumed by the 50m column painter.
  mem.write8(M50_OBJ_ROW_SHIFT, mem.read8(SPRITE_OBJ_REC2_X) - 0x3b);

  // Fall into the colour cycle.
  serviceColorCycle(m);
}
