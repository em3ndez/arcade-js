// SPDX-License-Identifier: GPL-3.0-only
/**
 * search75mObjectOverlap — run two bounding-box collision sweeps, stopping at the first hit.
 *
 * The 75m arm of the board-overlap-search dispatch: that dispatch reads BOARD and, for board
 * 3, jumps here having pushed the caller's per-axis search tolerances on the stack. It is the
 * two-sweep member of a family — the other boards run one sweep or three, over different
 * arrays and counts. It recovers the pushed tolerances, then points the shared bounding-box
 * collision search at two object arrays in turn:
 *
 *   sweep 1: OBJ_ARRAY_64, 0x20-byte stride, 5 records.
 *   sweep 2: OBJ_ARRAY_65, 0x10-byte stride, 10 records.
 *
 * Before each sweep it records that sweep's object count in OBJ_SEARCH_COUNT, where the
 * found-handler reads it back to recover the matched record's index (that count minus the
 * search's residual B). The reference coordinate and reference pointer — Mario's position —
 * arrive from the dispatch in registers and pass through untouched.
 *
 * THE SHORT-CIRCUIT, which is what distinguishes this from the single-sweep arms. If sweep 1
 * finds a hit, the collision search takes its caller-skip return, which unwinds PAST this
 * routine — so sweep 2 never runs and OBJ_SEARCH_COUNT is left holding the sweep-1 count of
 * 5, not the sweep-2 count of 10. Only when sweep 1 is exhausted does control fall through to
 * re-aim at the second array and scan again. A hit on EITHER sweep, and the exhausted-both
 * case, all hand control back to the dispatch site the same way, so this routine always
 * completes as a normal return.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory, plus the search result the dispatch caller consumes —
 * the result byte in the accumulator and the count-minus-index residue in B, from whichever
 * sweep last ran.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 5;    // records the first sweep scans (OBJ_ARRAY_64)
const SWEEP1_STRIDE = 0x20; // 0x20-byte record stride of OBJ_ARRAY_64
const SWEEP2_COUNT = 10;   // records the second sweep scans (OBJ_ARRAY_65)
const SWEEP2_STRIDE = 0x10; // 0x10-byte record stride of OBJ_ARRAY_65

export function search75mObjectOverlap(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the dispatcher pushed (axis-1 in the low byte,
  // axis-2 in the high), where the collision search reads them.
  regs.hl = m.pop16();

  // Sweep 1: record its object count, aim the shared collision search at OBJ_ARRAY_64, and
  // run one scan. A hit takes the search's caller-skip return, which unwinds past this routine
  // entirely — so on a hit here sweep 2 never runs and OBJ_SEARCH_COUNT stays at this count.
  mem.write8(OBJ_SEARCH_COUNT, SWEEP1_COUNT);
  regs.b = SWEEP1_COUNT;
  regs.de = SWEEP1_STRIDE;
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true;

  // Sweep 2: reached only when sweep 1 found nothing. Re-record the count, re-aim at
  // OBJ_ARRAY_65, and scan again; a hit or an exhausted scan both hand control back the same
  // way. Only the low half of DE changes — the high half is already 0 from the sweep-1 stride.
  mem.write8(OBJ_SEARCH_COUNT, SWEEP2_COUNT);
  regs.b = SWEEP2_COUNT;
  regs.de = SWEEP2_STRIDE;
  regs.ix = OBJ_ARRAY_65;
  findCollidingObject(m);

  return true;
}
