// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceColorCycle — the per-frame entry to the state-0 colour cycle: advance a running
 * sweep, or re-arm a fresh one at the frame-counter wrap, else just repaint.  ROM 0x0413.
 *
 * Called once per frame in the colour-cycle context (entry_03fb / entry_0400 tail-call it
 * whenever the mode selector is not board 2). It is the outer gate in front of the sweep
 * driver advanceColorCycleSweep, and it decides which of three things this frame does:
 *
 *   - A sweep is already running (COLOUR_CYCLE_ACTIVE set) -> advanceColorCycleSweep:
 *     step the sweep counter and paint this frame's colour work.
 *   - No sweep running, and this is not the frame-counter wrap (FRAME != 0) ->
 *     dispatchColorCyclePaint: the colour-column repaint only, with no sweep advancing.
 *   - No sweep running AND the frame counter has just wrapped to 0 -> ARM a fresh sweep
 *     (set COLOUR_CYCLE_ACTIVE) and immediately advance it.
 *
 * So the sweep is re-armed once per frame-counter wrap (every 256 frames) and then runs for
 * its 0x80-count lifetime; resetColorCycleSweep (inside the driver) clears the active flag
 * when the counter tops out, and this routine sets it again at the next wrap. This routine's
 * only direct write is that re-arm of COLOUR_CYCLE_ACTIVE; every colour/sprite write happens
 * in the callees.
 *
 * Both callees read their inputs (the active flag, the sweep counter, the board) straight
 * from RAM and take no register live-in, so both are bare direct calls — no register-ABI
 * marshalling.
 *
 * NAME (promoted, DK understanding pass 7 — independent proposer≠confirmer): this IS the
 * colour-cycle service entry / re-arm. It reads COLOUR_CYCLE_ACTIVE + FRAME, sets
 * COLOUR_CYCLE_ACTIVE at the frame-counter wrap, and dispatches only to the colour-cycle
 * routines; its sole write is that re-arm. Grounded by the [seen] COLOUR_CYCLE_ACTIVE (0x6391)
 * cell, whose registry comment names this routine (ROM 0x0423) the re-arm site of the sweep
 * driver / clear trio.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0413.test.js.
 * GATE:     strict/whole-contract over real captured 0x0413 dispatches (all three routes occur
 *           naturally in a 25m attract) + crafted entries that force each route, the
 *           nonzero-not-1 active gate, the nonzero-not-1 frame gate, a wrap that immediately
 *           tops the armed sweep out, a wrap that lands on a 32-frame boundary reload, and the
 *           rivet-board repaint. Whole contract each time: RAM - STACK_SCRATCH + pc + SP; the
 *           candidate models its one net return with a single m.ret(). Teeth: a dropped re-arm
 *           write, a repaint arm that advances instead, an inverted active gate, and an
 *           active gate that tests ==1 instead of nonzero.
 * LIVE-OUT: memory-only — the callers tail-call this routine and read no register afterwards,
 *           so the oracle's residual registers/flags are dead ABI. SP/PC are the single net
 *           return the JS call stack replaces (the harness supplies one m.ret()).
 * NAMES:    COLOUR_CYCLE_ACTIVE (0x6391), FRAME (0x601A) — both from names.js. The sweep counter
 *           (0x6390) and every colour/sprite cell live inside the callees.
 */

import { COLOUR_CYCLE_ACTIVE, FRAME } from "./names.js";
import { advanceColorCycleSweep } from "./advanceColorCycleSweep.js"; // ROM 0x0426
import { dispatchColorCyclePaint } from "./dispatchColorCyclePaint.js"; // ROM 0x0486

export function serviceColorCycle(m) {
  const { mem } = m;

  // A sweep is already running: advance it and paint this frame's colour work.
  if (mem.read8(COLOUR_CYCLE_ACTIVE) !== 0) {
    advanceColorCycleSweep(m);
    return;
  }

  // No sweep running. On every frame but the frame-counter wrap, just repaint the column.
  if (mem.read8(FRAME) !== 0) {
    dispatchColorCyclePaint(m);
    return;
  }

  // Frame-counter wrap with no sweep running: arm a fresh sweep, then advance it immediately.
  mem.write8(COLOUR_CYCLE_ACTIVE, 1);
  advanceColorCycleSweep(m);
}
