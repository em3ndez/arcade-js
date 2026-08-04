// SPDX-License-Identifier: GPL-3.0-only
/**
 * search50mObjectOverlap — run the conveyor board's three bounding-box collision sweeps over
 * three object arrays in order, stopping at the first overlap.
 *
 * The board collision dispatcher jumps here for this board, having first pushed the per-axis
 * search tolerances on the stack. This routine recovers that pair and then runs three
 * back-to-back sweeps, each pointing the shared collision search at a different object array
 * and stamping that sweep's record count where the found-handler reads it back to recover the
 * matched record's index:
 *
 *   sweep 1 — the five-record array, 32-byte stride
 *   sweep 2 — the six-record array of this board's own movers, 16-byte stride
 *   sweep 3 — a single record, stride zero, looked at once
 *
 * The sweeps run in order and stop at the FIRST hit: the search takes a caller-skip return that
 * splices control straight back up to the dispatch site and abandons the remaining sweeps. So
 * the stored count is left holding whichever sweep terminated the routine — five, six or one on
 * a hit, and one when all three come up empty, since that is the last value written.
 *
 * The stride is loaded as a full 16-bit word for sweep 1 only; sweeps 2 and 3 reload just its
 * low byte, because the search preserves the high byte and it stays zero throughout.
 *
 * WHY THIS BOARD: it is the only one of the collision arms that sweeps this board's own mover
 * array, and the dispatcher's board table vectors here for exactly that board.
 *
 * The tolerances arrive on the stack and the collision search reads its inputs from registers,
 * so this routine recovers the pushed pair into the tolerance registers and loads each sweep's
 * record base, stride and count before handing off. The reference coordinate and reference
 * pointer are the dispatcher's, and pass through untouched.
 *
 * Reads: the pushed tolerances and, through the search, the object records. Writes: the
 * search-count cell, once per sweep.
 *
 * LIVE-OUT: the search-count cell in memory, plus the search result the dispatch caller
 * consumes — a hit/miss byte and the count-minus-index residue, left by whichever sweep ran
 * last.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function search50mObjectOverlap(m) {
  const { regs, mem } = m;

  // Recover the per-axis search tolerances the dispatcher pushed (the search reads the axis-1
  // tolerance from the low byte and the axis-2 tolerance from the high byte).
  regs.hl = m.pop16();

  // Sweep 1 — the five-record array, 32-byte stride. Loads the full stride word.
  mem.write8(OBJ_SEARCH_COUNT, 0x05);
  regs.b = 0x05;
  regs.de = 0x0020;
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true; // a hit skips the remaining sweeps

  // Sweep 2 — this board's mover array, 16-byte stride, 6 records. Only the stride's low byte
  // is reloaded; the high byte stays zero.
  mem.write8(OBJ_SEARCH_COUNT, 0x06);
  regs.b = 0x06;
  regs.e = 0x10;
  regs.ix = OBJ_ARRAY_65A0;
  if (!findCollidingObject(m)) return true;

  // Sweep 3 — the single record, stride zero. A zero stride would rescan the same record, and
  // a count of one makes it a single look. Again only the stride's low byte is reloaded.
  mem.write8(OBJ_SEARCH_COUNT, 0x01);
  regs.b = 0x01;
  regs.e = 0x00;
  regs.ix = OBJ_RECORD_66A0;
  if (!findCollidingObject(m)) return true;

  // All three sweeps exhausted with no hit — a normal return to the dispatch site.
  return true;
}
