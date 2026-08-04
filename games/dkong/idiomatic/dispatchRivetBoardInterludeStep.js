// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchRivetBoardInterludeStep — vector the rivet-board interlude's render sequence to the
 * handler for its current step.
 *
 * The same inline-jump-table idiom the game's other sub-state dispatchers use: read a one-byte step
 * index and vector through a table of little-endian target addresses to the handler for that step.
 * Here the selector is BOARD_ADVANCE_STEP, the interlude's own step counter, and the table has six
 * entries — the steps that seed the sequence and redraw the playfield, wait out a gated tick,
 * animate the figure, reload its template, slide it one column, and finally wind the interlude down.
 *
 * The trampoline is folded in rather than called: the table base is a compile-time constant here,
 * so the whole mechanism reduces to "read table[step], dispatch". The trampoline's register and
 * flag hand-off is NOT reproduced, because it is dead to every arm — each arm's first act loads the
 * registers it wants, reading none of it — so folding it away leaves memory identical.
 *
 * Doubling the step into a table offset is an 8-BIT operation, so the address math is
 * `base + (2*step & 0xff)`: a step of 0x80 or more wraps back into the table rather than running
 * off the end. Only steps 0..5 occur in play; the wrap is reproduced for every other value.
 *
 * The dispatch is genuine computed control flow into a table of targets, so it routes through the
 * generic address dispatcher rather than a local JS function table.
 *
 * WHAT THE NAME CLAIMS. The selector is the board-advance step counter and the body is a plain
 * vector, so the name commits to WHICH sequence is being vectored and to nothing else. NOT CLAIMED:
 * what the arms draw. No step handler is described here, and the visual reading of the sequence is
 * not derivable from this file.
 *
 * Reads: BOARD_ADVANCE_STEP, and the two target bytes at the selected table entry. Writes: nothing
 * of its own.
 * LIVE-OUT: memory-only — the dispatched arm's writes. The arm's return value is discarded at this
 * level, so this routine returns nothing.
 */

import { loc_00ca } from "../translated/loc_00ca.js";
import { BOARD_ADVANCE_STEP } from "./names.js"; // the interlude step selector (0..5 in play)

// The inline jump table: six little-endian target addresses, indexed by the step. It lives in
// program memory rather than work RAM, so it carries no cell name and stays hex.
const STEP_TABLE = 0x1648;

// The dispatch-site label handed to the generic dispatcher. It only ever surfaces inside a
// NotImplemented throw, naming which inline table an out-of-range selector fell off of.
const DISPATCH_TABLE_1648 = "0x1648 (0x6388 sequence)";

export function dispatchRivetBoardInterludeStep(m) {
  const { mem } = m;

  // The interlude sequence step index (0..5 in play).
  const step = mem.read8(BOARD_ADVANCE_STEP);

  // Doubling the index into a 2-byte table offset is an 8-BIT result — a step of 0x80 wraps the
  // offset back to 0 — so the address math is `base + (2*step & 0xff)`, NOT `base + 2*step`.
  // Then read the little-endian target word at that entry.
  const entry = (STEP_TABLE + ((step * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // Dispatch to the step handler. The arm's return value is discarded at this level, so this
  // routine returns nothing.
  loc_00ca(m, target, DISPATCH_TABLE_1648);
}
