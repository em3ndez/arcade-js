// SPDX-License-Identifier: GPL-3.0-only
/**
 * search25mObjectOverlap — the barrel board's collision arm. Recovers the per-axis search
 * tolerances the dispatcher pushed, then runs three back-to-back bounding-box sweeps, stamping
 * each sweep's record count into OBJ_SEARCH_COUNT and pointing the shared search at a different
 * object array; the first overlap takes a caller-skip return that stops the later sweeps. Both
 * exits unwind to the same dispatch point, so this reports a normal return on every path. The
 * stride's high byte stays zero, so sweeps 2 and 3 reload only its low byte.
 *
 * LIVE-OUT: the search-count cell plus the search result in registers (the tolerance word, stride
 * and array base ride each exit's return so they persist as the search leaves them).
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_67, OBJ_ARRAY_64, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 0x0a;
const SWEEP2_COUNT = 0x05;
const SWEEP3_COUNT = 0x01;
const RECORD_STRIDE = 32;

export function search25mObjectOverlap(m) {
  const { regs, mem8 } = m;

  // Recover the pushed tolerances: low byte = axis-1 window, high byte = axis-2 window.
  const bounds = m.pop16();
  const tolLow = bounds & 0xff;
  const tolHigh = bounds >> 8;

  // Sweep 1 — barrel array, 10 records, 32-byte stride. The count is the search's record budget.
  mem8[OBJ_SEARCH_COUNT] = SWEEP1_COUNT;
  // prettier-ignore
  if (!findCollidingObject(m, OBJ_ARRAY_67, undefined, tolLow, undefined, tolHigh, RECORD_STRIDE, SWEEP1_COUNT)) return (regs.hl = bounds, regs.de = RECORD_STRIDE, regs.ix = OBJ_ARRAY_67, true);

  // Sweep 2 — five-record array, same stride.
  mem8[OBJ_SEARCH_COUNT] = SWEEP2_COUNT;
  // prettier-ignore
  if (!findCollidingObject(m, OBJ_ARRAY_64, undefined, tolLow, undefined, tolHigh, RECORD_STRIDE, SWEEP2_COUNT)) return (regs.hl = bounds, regs.de = RECORD_STRIDE, regs.ix = OBJ_ARRAY_64, true);

  // Sweep 3 — single record, stride zero.
  mem8[OBJ_SEARCH_COUNT] = SWEEP3_COUNT;
  findCollidingObject(m, OBJ_RECORD_66A0, undefined, tolLow, undefined, tolHigh, 0, SWEEP3_COUNT);
  return (regs.hl = bounds, regs.de = 0, regs.ix = OBJ_RECORD_66A0, true);
}
