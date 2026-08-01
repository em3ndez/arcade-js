// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetColorCycleSweep — reset (end) the colour-cycle sweep when its counter tops out, then
 * continue the frame's colour work.  ROM 0x0464.
 *
 * The colour-cycle sweep counter climbs one step per frame and reaches its top of 0x80 once
 * per sweep; its driver (loc_0426, which does the increment) jumps here on the frame it wraps.
 * This routine ends the sweep — clear the counter back to 0 and lower the colour-cycle active
 * flag — and then continues into the SAME per-frame colour work the non-wrap path runs, selected
 * by the sprite-object reload gate. (It is the reset/end half only: the re-arm that STARTS the
 * next sweep is loc_0413's job at the next FRAME wrap, not this routine's — hence "reset", not
 * "restart".)
 *
 *   - reload gate NONZERO -> straight into the colour-cycle repaint, skipping both the
 *     sprite-object block reload and the cascade's per-board sprite-column shift.
 *   - reload gate ZERO    -> reload the 40-byte sprite-object block from its ROM template,
 *     then run the full colour-cascade dispatch (dispatchColorCascadeByBoard), which additionally
 *     shifts the sprite-object column by board before the repaint.
 *
 * So the top-of-sweep frame both resets the counter and re-seeds the sprite-object block
 * from ROM, unless the gate suppresses the reload. This routine's own writes are just the two
 * counter clears; the block reload and every colour/sprite write happen in the callees.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): ram.js COLOUR_CYCLE_ACTIVE (0x6391)
 * explicitly cites this routine — "loc_0464 clears it to 0 when the counter finishes its sweep at
 * 0x80 (ROM 0x0468)" — pinning the reset/end role on a named cell.
 *
 * REGISTER-ABI MARSHALLING (dissolves once loadSpriteObjectBlock takes an honest source
 * param): that callee still reads its copy SOURCE from a register, so on the reload arm this
 * routine loads the ROM template address exactly as the oracle's `call` site does.
 * dispatchColorCyclePaint and dispatchColorCascadeByBoard read their inputs (the board and the
 * sweep counter) from RAM, so both are bare calls.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0464.test.js.
 * GATE:     strict/whole-contract over real captured dispatches — 0x0464 fires in attract every
 *           time the sweep tops out, and BOTH arms occur naturally (the gate-nonzero repaint arm
 *           and the gate-zero reload arm) — plus crafted entries forcing each arm, a non-1
 *           nonzero gate, and the rivet/even-board callee routes. Whole contract each time:
 *           RAM − STACK_SCRATCH + pc + SP; the candidate models its one net return with a single
 *           m.ret(). Teeth: dropped active-flag clear, dropped counter clear, inverted reload
 *           gate, and a wrong template source.
 * LIVE-OUT: memory-only — the two counter clears plus whatever the callees paint/reload. The
 *           cascade returns up to a caller that reads no register before overwriting it, so the
 *           oracle's residual registers/flags are dead ABI. SP/PC are the single net return the
 *           JS call stack replaces (the harness supplies one m.ret()).
 * NAMES:    COLOUR_CYCLE_ACTIVE (0x6391) from ram.js. The sweep counter 0x6390 and the reload
 *           gate 0x6393 are UNNAMED in ram.js (both shared bytes left hex) — kept local hex
 *           consts. The ROM template address 0x385c is an immediate.
 */

import { COLOUR_CYCLE_ACTIVE } from "./ram.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js"; // ROM 0x0486
import { dispatchColorCascadeByBoard } from "./dispatchColorCascadeByBoard.js"; // ROM 0x0450

const SWEEP_COUNTER = 0x6390; // colour-cycle sweep counter (unnamed/shared in ram.js — kept hex)
const OBJ_RELOAD_GATE = 0x6393; // 0 -> reload the block + full cascade; nonzero -> repaint only (shared — hex)
const OBJ_TEMPLATE = 0x385c; //   ROM sprite-object template copied into the block on the reload arm

export function resetColorCycleSweep(m) {
  const { regs, mem } = m;

  // Top of the sweep: restart the counter and lower the colour-cycle active flag.
  mem.write8(SWEEP_COUNTER, 0);
  mem.write8(COLOUR_CYCLE_ACTIVE, 0);

  // Gate set: skip the sprite-object reload and go straight to the colour-cycle repaint.
  if (mem.read8(OBJ_RELOAD_GATE) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  // Gate clear: reload the sprite-object block from its ROM template, then run the full cascade.
  regs.hl = OBJ_TEMPLATE; // loadSpriteObjectBlock reads its source pointer from a register
  loadSpriteObjectBlock(m);
  dispatchColorCascadeByBoard(m);
}
