// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02e1 — the round-start intro-hold loop: repaint the "PLAYERS" HUD label and one
 * playfield strip, spaced by two short frame-waits, for a caller-armed number of passes,
 * then hand off to the round-loop setup.  ROM 0x02e1.
 *
 * This is the loop the round-start setup flows into after it has painted the "MEN LEFT"
 * panel: it is entered both by falling through from that setup and by looping back on
 * itself. Each pass repaints the "PLAYERS" label and one fixed playfield strip, then
 * holds — a ten-frame wait and a five-frame wait — so the freshly-built board sits on
 * screen for a couple of seconds before play begins.
 *
 * How many passes it runs is not decided here: it drains the value the caller left in the
 * shared loop counter. A pass is always run first and the counter is only decremented and
 * tested afterwards, so at least one pass always happens; a counter left at zero wraps and
 * runs a full 256 passes (faithful to the original). When the counter reaches zero the
 * routine hands off to the round-loop setup — a tail jump whose own return carries this
 * routine's caller, so control never comes back here.
 *
 * The frame-waits still return through the work stack (their return is carried back by the
 * stack rather than a plain JS return), so each is handed the slot it pops; the label and
 * strip painters are idiomatic and called directly. The closing tail hand-off to the
 * round-loop setup (loc_031a, 0x031a) is kept as an m.call boundary: loc_031a falls into the
 * never-returning main loop, so it stays a registry boundary the equivalence harness can stub
 * or bound rather than a direct call.
 *
 * NAME kept loc_02e1: which round boundary this intro belongs to (new game vs. new level
 * vs. player changeover) is not pinned — the same reason its parent setup stays neutral —
 * so an English name would over-claim which screen this holds.
 *
 * Memory-equivalent to the frozen oracle — equivalence-02e1.test.js.
 * GATE:     crafted-entry — never dispatched in plain attract (the round-start path), so it
 *           is validated on a real attract machine state captured at a shared callee's
 *           dispatch (loc_3dae), with the caller-armed pass count poked to a small value.
 *           The frame-waits busy-wait on a per-frame countdown the interrupt drains in the
 *           live game; run in isolation that tick is modelled by one identical hook on both
 *           sides so the waits terminate. The tail loc_031a paints the board and falls into
 *           the never-returning main loop, so both arms run the real chain under that same
 *           watchdog hook and stop at the main loop's entry. The RAM-only diff excludes the
 *           dead stack-scratch window the dissolved calls no longer write. Teeth: a
 *           corrupted painted cell and an un-drained pass counter.
 * LIVE-OUT: memory-only — the repainted "PLAYERS" label + playfield strip and the pass
 *           counter drained to 0. No register or flag is read back: the routine tail-jumps
 *           into the round loop and the caller's return is carried by loc_031a.
 * NAMES:    LOOP_COUNTER (0x800a) from ram.js. loc_031a is the idiomatic round-loop setup
 *           (the tail target).
 */

import { drawPlayerLabel } from "./drawPlayerLabel.js";
import { waitFrames } from "./waitFrames.js";
import { loc_4816 } from "./loc_4816.js";
import { LOOP_COUNTER } from "./ram.js";

export function loc_02e1(m) {
  const { mem8 } = m;

  // Hold the intro for as many passes as the caller armed in the loop counter. Each pass
  // repaints the "PLAYERS" label and one playfield strip, then spaces them with a ten-frame
  // and a five-frame wait. The frame-waits return through the work stack, so each is handed
  // the slot it pops; the painters are ordinary calls.
  do {
    drawPlayerLabel(m);
    m.push16(0x02e9); // the frame-wait returns through the work stack; push the slot it pops
    waitFrames(m, 10);
    loc_4816(m);
    m.push16(0x02f1);
    waitFrames(m, 5);
    mem8[LOOP_COUNTER] = mem8[LOOP_COUNTER] - 1;
  } while (mem8[LOOP_COUNTER] !== 0);

  // Hand off to the round-loop setup. Its own return carries this routine's caller, so
  // control never comes back here.
  // m.call boundary: tail hand-off into the never-returning round init (loc_031a 0x031a,
  // which falls into mainLoop); a direct call is behaviorally identical and a terminal-test
  // would be a fragile artifact.
  return m.call(0x031a);
}
