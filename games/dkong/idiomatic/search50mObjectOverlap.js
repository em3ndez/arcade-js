// SPDX-License-Identifier: GPL-3.0-only
/**
 * search50mObjectOverlap — the conveyor board's collision arm. Recovers the per-axis search
 * tolerances the dispatcher pushed, then runs three back-to-back bounding-box sweeps, stamping
 * each sweep's record count into OBJ_SEARCH_COUNT and pointing the shared search at a different
 * object array; the first overlap takes a caller-skip return that abandons the later sweeps.
 * The stride's high byte stays zero, so sweeps 2 and 3 reload only its low byte.
 *
 * LIVE-OUT: the search-count cell plus the search result the dispatch caller consumes (the
 * tolerance word, stride and array base ride each exit's return so they persist).
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function search50mObjectOverlap(m) {
  const { regs, mem8 } = m;

  const bounds = m.pop16();
  const tolLow = bounds & 0xff;
  const tolHigh = bounds >> 8;

  // Sweep 1 — five-record array, 32-byte stride. The count is the search's record budget.
  mem8[OBJ_SEARCH_COUNT] = 0x05;
  // prettier-ignore
  if (findCollidingObject(m, OBJ_ARRAY_64, undefined, tolLow, undefined, tolHigh, 32, 0x05).hit) return (regs.hl = bounds, regs.de = 32, regs.ix = OBJ_ARRAY_64, true);

  // Sweep 2 — this board's mover array, 16-byte stride, 6 records.
  mem8[OBJ_SEARCH_COUNT] = 0x06;
  // prettier-ignore
  if (findCollidingObject(m, OBJ_ARRAY_65A0, undefined, tolLow, undefined, tolHigh, 16, 0x06).hit) return (regs.hl = bounds, regs.de = 16, regs.ix = OBJ_ARRAY_65A0, true);

  // Sweep 3 — single record, stride zero.
  mem8[OBJ_SEARCH_COUNT] = 0x01;
  findCollidingObject(m, OBJ_RECORD_66A0, undefined, tolLow, undefined, tolHigh, 0, 0x01);
  return (regs.hl = bounds, regs.de = 0, regs.ix = OBJ_RECORD_66A0, true);
}
