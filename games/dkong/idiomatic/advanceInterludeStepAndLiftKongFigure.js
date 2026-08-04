// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceInterludeStepAndLiftKongFigure — bump the board-advance sequence step, then (only on the 25m board)
 * subtract 4 from field 3 of every sprite-object record.  ROM 0x1662.
 *
 * The shared tail of two 0x1644-index board-setup handlers: beginKongRecaptureInterlude falls through
 * into it and stageKongClimbPose jumps to it. It does three things:
 *
 *   1. `inc (0x6388)` — advance BOARD_ADVANCE_STEP, the board-advance sequence step (the
 *      same counter loc_17b6 seeds elsewhere). Runs unconditionally.
 *   2. `rst 0x30` with A = 1 — the per-board skip gate (boardBitGate). A is a mask
 *      with one bit per board; boardBitGate selects the current board's bit. With
 *      A = 1 (bit 0 = 25m) it is set only on BOARD ≡ 1 (mod 8), i.e. the 25m girder
 *      board. In the oracle this is the rst caller-skip idiom, which boardBitGate
 *      already models as a boolean return — so it collapses to a plain guard here.
 *   3. `rst 0x38` with HL = 0x690B, C = 0xFC — addToSpriteObjectColumn adds C into
 *      field 3 (+3) of all ten sprite-object records, stride 4. C = 0xFC is -4
 *      (8-bit, wraps), so this shifts that whole column of ten records by -4.
 *
 * Because advanceInterludeStepAndLiftKongFigure is entered by fall-through it owns no return address, so in the
 * oracle the gate's skip arm and its fall-through arm converge on the same pc/SP; the
 * gate's only game-visible effect is whether step 3 runs. Both callees are already
 * idiomatic leaves (boardBitGate = ROM 0x0030, addToSpriteObjectColumn = ROM 0x0038)
 * and are called directly; neither touches the Z80 stack.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1662.test.js.
 * GATE:     crafted-entry, exhaustive over BOARD (0..255). A 6000-frame attract run
 *           dispatches 0x1662 ZERO times (it is a credited game's board-setup tail),
 *           so both arms are crafted from a real booted machine with BOARD poked.
 * LIVE-OUT: memory-only — the inc at 0x6388 and the ten strided bytes from 0x690B.
 *           Control returns to the board-setup dispatcher, which reloads its own
 *           registers/flags; no register or flag is live out (the oracle just `ret`s
 *           with no result convention). SP/pc are not compared: the oracle models the
 *           rst push/pop in STACK_SCRATCH, this routine needs no stack at all.
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908; the strided target 0x690B is field 3 = +3) and
 *           BOARD_ADVANCE_STEP (0x6388, the board-advance sequence step) from names.js.
 *           BOARD (0x6227) is read by boardBitGate, not here.
 */

import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30) — the per-board skip gate
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

export function advanceInterludeStepAndLiftKongFigure(m) {
  const { regs, mem } = m;

  // inc (0x6388) — advance the board-advance sequence step (both arms).
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);

  // rst 0x30 board gate. A = 1 asks "is bit 0 (25m) set for the current board?"; a
  // false return means "not this board" — skip the strided subtract. The oracle's
  // caller-skip is already the boolean boardBitGate returns.
  regs.a = 0x01;
  if (!boardBitGate(m)) return;

  // rst 0x38: subtract 4 from field 3 of each of the ten sprite-object records
  // (stride 4, count 10 hard-wired inside; C = 0xFC = -4, 8-bit wrapping).
  regs.hl = SPRITE_OBJ_BLOCK + 3; // 0x690b
  regs.c = 0xfc; // -4
  addToSpriteObjectColumn(m);
}
