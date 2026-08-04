// SPDX-License-Identifier: GPL-3.0-only
/**
 * search100mObjectOverlap — run one bounding-box collision sweep over the OBJ_ARRAY_64 object
 * array, the hazard array 100m uses.
 *
 * The board-overlap-search dispatch jumps here on 100m, having pushed the caller's per-axis
 * search tolerances on the stack. This routine recovers them, records the sweep's object
 * count where the found-handler reads it back, points the shared bounding-box collision
 * search at OBJ_ARRAY_64, and runs one scan for the first record whose box overlaps the
 * reference point. It is the single-sweep member of a family: the other boards run two or
 * three sweeps over different arrays.
 *
 * The scan reports its result in registers: a hit sets the result byte to 1 and leaves the
 * count-minus-index residue behind so the found-handler can recover the matched record's
 * index; an exhausted scan leaves the result byte 0. On a hit the search takes its
 * caller-skip return, which here only skips this routine's own trivial tail — both outcomes
 * hand control back to the dispatch site the same way — so this routine always completes as
 * a normal return.
 *
 * The tolerances arrive on the stack and the collision search reads its inputs from
 * registers, so this routine recovers the pushed pair into the tolerance registers and loads
 * the record base, stride and count before handing off. The reference coordinate and
 * reference pointer are set by the dispatch above and pass through untouched.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory, plus the search result the dispatch caller consumes —
 * the result byte in the accumulator and the count-minus-index residue.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP_COUNT = 7;   // records this sweep scans
const RECORD_STRIDE = 32; // 0x20-byte record stride of OBJ_ARRAY_64

export function search100mObjectOverlap(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the dispatcher pushed (the collision search
  // reads the axis-1 tolerance from the low byte and the axis-2 tolerance from the high).
  regs.hl = m.pop16();

  // Record how many records this sweep covers, where the found-handler reads it back.
  mem.write8(OBJ_SEARCH_COUNT, SWEEP_COUNT);

  // Aim the shared collision search at the object array and run one sweep. It reports its
  // result in registers; the reference coordinate and reference pointer come in from the
  // dispatcher untouched.
  regs.b = SWEEP_COUNT;
  regs.de = RECORD_STRIDE;
  regs.ix = OBJ_ARRAY_64;
  findCollidingObject(m);

  // A hit's caller-skip only skips this routine's own tail, so control returns to the
  // dispatch site the same way on both outcomes — always a normal return.
  return true;
}
