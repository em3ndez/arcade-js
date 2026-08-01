// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0426 — advance the colour-cycle sweep counter one step per frame and dispatch this
 * frame's colour work.  ROM 0x0426.
 *
 * The per-frame driver of the state-0 colour cycle: loc_0413 gates on the colour-cycle
 * active flag and the frame counter, then falls in here. It bumps the sweep counter (0x6390)
 * by one and, on the post-increment value, routes the frame's colour work four ways:
 *
 *   - counter reached its top (0x80)            -> resetColorCycleSweep: end the sweep (clear
 *     the counter and the active flag) and run this frame's colour work.
 *   - sprite-object reload gate (0x6393) != 0   -> dispatchColorCyclePaint: the colour-cycle
 *     repaint only, with no sprite-object reload.
 *   - not a 32-frame boundary (counter & 0x1f != 0, gate == 0) -> dispatchColorCyclePaint:
 *     the same repaint-only path on the in-between frames.
 *   - a 32-frame boundary (counter a nonzero multiple of 32, gate == 0) -> reload the 40-byte
 *     sprite-object block from a ROM template, raise the 0x6082 request byte, then run the full
 *     colour cascade (dispatchColorCascadeByBoard).
 *
 * On a boundary the template alternates with the counter's bit 5: bit 5 set (counter 0x20,
 * 0x60) reloads from 0x39cf, bit 5 clear (counter 0x40) from 0x39f7 — so the two templates
 * swap every 32 frames.
 *
 * This routine's only direct writes are the counter step and, on the boundary arm, the 0x6082
 * request byte; every colour/sprite write happens in the callees.
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned to the oracle and clearly the
 * colour-cycle sweep driver, but its primary cells (the sweep counter 0x6390 and the reload
 * gate 0x6393) are deliberately unnamed/shared in ram.js, so the routine-name bar is not met by
 * a single decompiler. Promote in a clarify pass with corroboration (candidate: advance the
 * colour-cycle sweep).
 *
 * Memory-equivalent to the frozen oracle — equivalence-0426.test.js.
 * GATE:     strict/whole-contract over real captured 0x0426 dispatches (both the repaint arm and
 *           the top-of-sweep reset occur naturally in a 25m attract) + crafted entries that force
 *           each of the four routes (top-of-sweep reset, gate-nonzero repaint, in-between repaint,
 *           and both bit-5 template arms of the 32-frame boundary, across boards). Whole contract
 *           each time: RAM - STACK_SCRATCH + pc + SP; the candidate models its one net return with
 *           a single m.ret(). The reload arm's push16/ret bracket around the block copy nets zero
 *           and writes only STACK_SCRATCH (excluded). Teeth: a dropped increment, a wrong
 *           top-of-sweep threshold, an inverted reload gate, and a swapped bit-5 template.
 * LIVE-OUT: memory-only — the counter step plus whatever the callees paint/reload. Every exit
 *           tail-chains into a callee whose own caller reads no register before overwriting it, so
 *           the oracle's residual registers/flags are dead ABI. SP/PC are the single net return the
 *           JS call stack replaces (the harness supplies one m.ret()).
 * NAMES:    none from ram.js — every cell this routine touches directly is unnamed there: the
 *           sweep counter 0x6390 and reload gate 0x6393 are deliberately kept hex (both SHARED
 *           bytes; ram.js rejected a colour-specific name), and 0x6082 is an unnamed shared
 *           request byte. The two ROM template addresses are immediates.
 *
 * REGISTER-ABI MARSHALLING (dissolves once loadSpriteObjectBlock takes an honest source param):
 * on the boundary arm that callee still reads its copy SOURCE from a register, so this routine
 * loads the chosen ROM template address exactly as the oracle's `call` site does.
 * resetColorCycleSweep, dispatchColorCyclePaint, and dispatchColorCascadeByBoard all read their
 * inputs (the gate, the counter, the board) from RAM, so those three are bare calls.
 */

import { u8 } from "../../../core/int.js";
import { resetColorCycleSweep } from "./resetColorCycleSweep.js";       // ROM 0x0464
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js"; // ROM 0x0486
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";     // ROM 0x004e
import { dispatchColorCascadeByBoard } from "./dispatchColorCascadeByBoard.js"; // ROM 0x0450

const SWEEP_COUNTER = 0x6390;   // colour-cycle sweep counter (unnamed/shared in ram.js — kept hex)
const OBJ_RELOAD_GATE = 0x6393; // 0 -> reload the block + full cascade; nonzero -> repaint only (shared — hex)
const OBJ_RELOAD_REQUEST = 0x6082; // request byte raised to 3 on the boundary reload arm (unnamed/shared — hex)
const SWEEP_TOP = 0x80;         // top of the counter's range; reaching it ends the sweep
const BOUNDARY_MASK = 0x1f;     // low 5 bits zero -> a 32-frame boundary
const TEMPLATE_BIT = 0x20;      // counter bit 5: selects which ROM template the boundary reloads from
const TEMPLATE_BIT5_SET = 0x39cf;   // ROM sprite-object template when counter bit 5 is set
const TEMPLATE_BIT5_CLEAR = 0x39f7; // ROM sprite-object template when counter bit 5 is clear

export function loc_0426(m) {
  const { regs, mem } = m;

  // Advance the sweep counter one step; every route reads this new value.
  const counter = u8(mem.read8(SWEEP_COUNTER) + 1);
  mem.write8(SWEEP_COUNTER, counter);

  // Top of the sweep: end it and run this frame's colour work.
  if (counter === SWEEP_TOP) {
    resetColorCycleSweep(m);
    return;
  }

  // Reload suppressed, or not a 32-frame boundary: the colour-cycle repaint only.
  if (mem.read8(OBJ_RELOAD_GATE) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }
  if ((counter & BOUNDARY_MASK) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  // A 32-frame boundary with the reload gate open: reload the sprite-object block from the ROM
  // template selected by the counter's bit 5, raise the reload-request byte, then run the full
  // colour cascade.
  regs.hl = (counter & TEMPLATE_BIT) !== 0 ? TEMPLATE_BIT5_SET : TEMPLATE_BIT5_CLEAR;
  loadSpriteObjectBlock(m);
  mem.write8(OBJ_RELOAD_REQUEST, 3);
  dispatchColorCascadeByBoard(m);
}
