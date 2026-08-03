// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_30ed — one frame of the five-slot object pass: gate, census, advance, gather.  ROM 0x30ED.
 *
 * Four steps in order, the first two of which can abandon the rest of the pass for this frame:
 *
 *   1. gateObjectUpdateByDifficulty (ROM 0x30FA) — the difficulty-paced frame gate. False means
 *      this is not one of the frames the object pass runs on.
 *   2. loc_313c (ROM 0x313C) — sweep the five OBJ_ARRAY_64 records, tally the live ones into
 *      OBJ_LIVE_COUNT and service one pending insert. False means the array came out empty, so
 *      there is nothing to advance and nothing to draw.
 *   3. ROM 0x31B1 (still frozen) — walk the same five records and run the per-object state
 *      machine on each occupied one.
 *   4. loc_34f3 (ROM 0x34F3) — gather the five records into five 4-byte sprite records.
 *
 * ALL THREE ARMS RESUME AT THE SAME PLACE, which is why this routine returns nothing on any of
 * them. Both early exits are the Z80 caller-skip idiom in the oracle: the callee discards
 * loc_30ed's own return address and returns a level further out, landing control exactly where
 * a normal return lands it — ROM 0x198F in the one caller.
 *
 * IT MUST NOT RETURN THE CALLEES' BOOLEANS. 0x30ED is not itself caller-skip-capable: the two
 * words the skip consumes are consumed inside 0x30FA / 0x313C, which is why machine.js's
 * SEAM_CALLER_SKIP lists those two and must NOT list 0x30ED. A `false` leaving here would make
 * the translated→idiomatic seam discard a second stack word this routine does not owe.
 *
 * Reads and writes no memory of its own — everything it touches, it touches through the four
 * callees.
 *
 * Memory-equivalent to the frozen oracle — equivalence-30ed.test.js.
 * GATE:     captured dispatches + a whole-attract live-wire run; no crafted entry is needed
 *           because plain attract reaches all three arms. 1532 natural dispatches over 4000
 *           attract frames (first at frame 586), classified from the ORACLE's own call
 *           sequence: 765 gate-skip / 286 census-skip / 481 full. 79 of those 1532 are replayed
 *           oracle-vs-rewrite on byte-identical clones and compared on RAM − STACK_SCRATCH plus
 *           the return value (pc/SP are not compared — the rewrite has no stack dance to
 *           preserve). The rewrite is then WIRED LIVE for a 2000-frame attract run and every
 *           frame of the trace is byte-identical to the all-oracle baseline, stack region
 *           included. Teeth: a dropped gate guard, a dropped census guard, gather-before-update,
 *           a returned boolean (invisible to the RAM diff — only the return assertion sees it),
 *           and a dropped oracle-boundary bracket (invisible to BOTH — only the live-wire run
 *           sees it).
 * LIVE-OUT: memory-only; returns undefined on all three arms. There is exactly one caller —
 *           translated/loc_197a.js at ROM 0x198C, the only `m.call(0x30ed)` in the tree — and
 *           all three arms resume at its ROM 0x198F, whose next act is `call 0x2E04`. That
 *           routine's first instruction loads the accumulator with a constant and its next act
 *           (`rst 0x30`, boardBitGate) reads only the accumulator and BOARD; it then loads IX,
 *           IY and its loop counter from constants, its per-object body at ROM 0x2E12 loads H
 *           and L from the object record, and ROM 0x2E78 loads DE from a constant. So every
 *           register and flag this routine leaves behind is overwritten before it is read. The
 *           live-wire run measures that rather than only arguing it.
 * NAMES:    none of its own — it names no cell because it touches none. Three of the four
 *           callees are idiomatic and are direct calls; ROM 0x31B1 has no idiomatic twin in
 *           ROUTINES yet and so stays an addressed `m.call` with its Z80 return bracket.
 */

import { gateObjectUpdateByDifficulty } from "./gateObjectUpdateByDifficulty.js"; // ROM 0x30FA
import { loc_313c } from "./loc_313c.js"; // ROM 0x313C
import { loc_34f3 } from "./loc_34f3.js"; // ROM 0x34F3

/** The address ROM 0x31B1's frozen oracle returns to — the return bracket its own `ret` consumes. */
const RESUME_AFTER_OBJECT_UPDATE = 0x30f6;

/**
 * @param {object} m  the machine.
 * @returns {void}  on every arm — see the header on why a boolean here would be a defect.
 */
export function loc_30ed(m) {
  // Not this frame's turn: the difficulty gate paces the whole pass.
  if (!gateObjectUpdateByDifficulty(m)) return;

  // Nothing live in the array: no state to advance and no sprites to gather.
  if (!loc_313c(m)) return;

  // oracle-boundary call: ROM 0x31B1 (the per-object state-machine walk) is still frozen, so it
  // is dispatched by address and still needs the return bracket its `ret` pops. Delete both
  // lines for a direct call once 0x31B1 has an idiomatic twin in ROUTINES.
  m.push16(RESUME_AFTER_OBJECT_UPDATE);
  m.call(0x31b1);

  loc_34f3(m);
}
