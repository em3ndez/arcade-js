// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_28e0 — run two bounding-box collision sweeps, stopping at the first hit.  ROM 0x28E0.
 *
 * The board-3 (75m) arm of the board-overlap-search dispatch (dispatchBoardOverlapSearch,
 * ROM 0x3E88): that dispatcher reads BOARD and, for board 3, jumps here having pushed the
 * caller's per-axis search tolerances on the stack. A two-sweep sibling of the single-sweep
 * loc_2901 and the three-sweep loc_28b0 — same shape, different arrays and counts. It
 * recovers the pushed tolerances, then points the shared collision search findCollidingObject at two
 * object arrays in turn:
 *
 *   sweep 1: OBJ_ARRAY_64 (0x6400), 0x20-byte stride, 5 records.
 *   sweep 2: OBJ_ARRAY_65 (0x6500), 0x10-byte stride, 10 records.
 *
 * Before each sweep it records that sweep's object count in OBJ_SEARCH_COUNT, where the
 * found-handler reads it back to recover the matched record's index (count minus findCollidingObject's
 * residual B). The reference coordinate and reference pointer (Mario's position) arrive from
 * the dispatcher in registers and pass through untouched.
 *
 * THE SHORT-CIRCUIT (what sets this apart from the single-sweep loc_2901). If sweep 1 finds
 * a hit, findCollidingObject takes its caller-skip return, which unwinds PAST this routine — so sweep 2
 * never runs and OBJ_SEARCH_COUNT is left holding the sweep-1 count (5), not the sweep-2
 * count (10). Only when sweep 1 is exhausted does control fall through to re-aim at the
 * second array and scan again. A hit on EITHER sweep, and the exhausted-both case, all hand
 * control back to the dispatch site the same way, so this routine always completes as a
 * normal return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-28e0.test.js.
 * GATE:     crafted entries (0x28e0 is never dispatched in attract — its board-3 table arm is
 *           reached only through the untranslated 0x286B -> 0x3E88 overlap-search caller,
 *           measured 0 dispatches over 2000 attract frames) driving each arm on a real
 *           attract base: a sweep-1 hit (the short-circuit — sweep 2 must NOT run and
 *           OBJ_SEARCH_COUNT stays 5), sweep-1-exhaust -> sweep-2 hit at the first and at a
 *           later record (the count-minus-index recovery), sweep-1-exhaust -> sweep-2
 *           exhausted, and a stack-passed-tolerance flip that decides sweep 1 (proving the
 *           `pop hl` marshalling is live). The RAM diff excludes the dead STACK_SCRATCH the
 *           oracle's dissolved pop/call/return bracket writes; every live cell is kept.
 *           Teeth: a twin that drops the short-circuit (runs sweep 2 after a sweep-1 hit), a
 *           twin that stores the wrong sweep-2 count, and a twin that scans the wrong sweep-2
 *           record count.
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory, plus the search result the dispatch caller consumes
 *           — result byte in the accumulator and the count-minus-index residue in B
 *           (findCollidingObject's live-out registers), from whichever sweep last ran. The oracle's
 *           dissolved push/call/return bracket is stack-only.
 * NAMES:    OBJ_SEARCH_COUNT (0x63B9), OBJ_ARRAY_64 (0x6400), OBJ_ARRAY_65 (0x6500) from
 *           ram.js; findCollidingObject (ROM 0x2913) direct-called.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65 } from "./ram.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 5;    // records the first sweep scans (OBJ_ARRAY_64)
const SWEEP1_STRIDE = 0x20; // 0x20-byte record stride of OBJ_ARRAY_64
const SWEEP2_COUNT = 10;   // records the second sweep scans (OBJ_ARRAY_65)
const SWEEP2_STRIDE = 0x10; // 0x10-byte record stride of OBJ_ARRAY_65

export function loc_28e0(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the dispatcher pushed (axis-1 in the low byte,
  // axis-2 in the high), where the collision search reads them.
  regs.hl = m.pop16();

  // Sweep 1: record its object count, aim the shared collision search at OBJ_ARRAY_64, and
  // run one scan. A hit takes findCollidingObject's caller-skip return, which unwinds past this routine
  // entirely — so on a hit here sweep 2 never runs and OBJ_SEARCH_COUNT stays at this count.
  mem.write8(OBJ_SEARCH_COUNT, SWEEP1_COUNT);
  regs.b = SWEEP1_COUNT;
  regs.de = SWEEP1_STRIDE;
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true;

  // Sweep 2: reached only when sweep 1 found nothing. Re-record the count, re-aim at
  // OBJ_ARRAY_65, and scan again; a hit or an exhausted scan both hand control back the same
  // way. (The oracle sets only E here, leaving D=0 from the sweep-1 stride — DE = 0x0010.)
  mem.write8(OBJ_SEARCH_COUNT, SWEEP2_COUNT);
  regs.b = SWEEP2_COUNT;
  regs.de = SWEEP2_STRIDE;
  regs.ix = OBJ_ARRAY_65;
  findCollidingObject(m);

  return true;
}
