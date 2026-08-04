// SPDX-License-Identifier: GPL-3.0-only
/**
 * search25mObjectOverlap — run the barrel board's three bounding-box collision sweeps,
 * stopping at the first overlap.
 *
 * The board collision dispatcher reaches this through its per-board table, having first pushed
 * the per-axis search tolerances on the stack. This routine recovers that pair and runs the
 * shared collision search over three object arrays in turn:
 *
 *   sweep 1 — the ten-record barrel array, 32-byte stride
 *   sweep 2 — the five-record array, same stride
 *   sweep 3 — a single record, stride zero
 *
 * Before each sweep it stamps that sweep's record count into the search-count cell, where the
 * found-handler reads it back to recover the matched record's index, and aims the search at the
 * array. The reference coordinate and reference pointer belong to the dispatcher and pass
 * through untouched. The stride is loaded as a full 16-bit word for sweep 1 only; sweeps 2 and
 * 3 reload just its low byte, because the high byte stays zero throughout.
 *
 * The FIRST sweep to find an overlapping record is a hit: the search takes a caller-skip return
 * that stops the remaining sweeps and hands control back to the dispatch site. If all three
 * come up empty the routine reaches that same site the normal way. Either way the result is
 * left in registers for the dispatcher — a hit/miss byte and the count-minus-index residue.
 *
 * WHY THIS BOARD: it is the only one of the collision arms that sweeps the barrel array, and
 * the dispatcher's board table vectors here for exactly that board.
 *
 * BOTH EXITS LAND IN THE SAME PLACE. The dispatcher is a pure trampoline with no tail of its
 * own, so a hit's two-level caller-skip and the all-miss normal return unwind to precisely the
 * same point. This routine therefore reports a normal return on every path; the load-bearing
 * effect of the caller-skip is only the early STOP of the later sweeps, which is the early
 * return in the body.
 *
 * Reads: the pushed tolerances and, through the search, the object records. Writes: the
 * search-count cell, once per sweep.
 *
 * LIVE-OUT: the search-count cell in memory — the last executed sweep's count — plus the search
 * result in registers.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_67, OBJ_ARRAY_64, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 0x0a;    // records the barrel-array sweep scans
const SWEEP2_COUNT = 0x05;    // records the second sweep scans
const SWEEP3_COUNT = 0x01;    // the single record of the third sweep
const RECORD_STRIDE = 0x0020; // stride of the two 32-byte-strided arrays

export function search25mObjectOverlap(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the board dispatcher pushed (the search reads the
  // axis-1 tolerance from the low byte and the axis-2 tolerance from the high byte).
  regs.hl = m.pop16();

  // -- sweep 1: the barrel array, 10 records, 32-byte stride --
  mem.write8(OBJ_SEARCH_COUNT, SWEEP1_COUNT);
  regs.b = SWEEP1_COUNT;
  regs.de = RECORD_STRIDE; // the high byte stays live across all three sweeps
  regs.ix = OBJ_ARRAY_67;
  if (!findCollidingObject(m)) return true; // hit -> stop; control unwinds to the dispatch site

  // -- sweep 2: the five-record array, same stride (reload the low byte only) --
  mem.write8(OBJ_SEARCH_COUNT, SWEEP2_COUNT);
  regs.b = SWEEP2_COUNT;
  regs.e = 0x20;
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true; // hit -> stop

  // -- sweep 3: the single record, stride zero --
  mem.write8(OBJ_SEARCH_COUNT, SWEEP3_COUNT);
  regs.b = SWEEP3_COUNT;
  regs.e = 0x00; // stride now zero in both bytes
  regs.ix = OBJ_RECORD_66A0;
  if (!findCollidingObject(m)) return true; // hit -> stop

  // All three sweeps missed -> normal return to the dispatch site.
  return true;
}
