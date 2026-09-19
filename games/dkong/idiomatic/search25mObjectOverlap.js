// SPDX-License-Identifier: GPL-3.0-only
/**
 * search25mObjectOverlap — the barrel board's collision arm. Recovers the per-axis search
 * tolerances the dispatcher pushed, then runs three back-to-back bounding-box sweeps, stamping
 * each sweep's record count into OBJ_SEARCH_COUNT and pointing the shared search at a different
 * object array; the first overlap takes a caller-skip return that stops the later sweeps. Both
 * exits unwind to the same dispatch point, so this reports a normal return on every path. The
 * stride's high byte stays zero, so sweeps 2 and 3 reload only its low byte.
 *
 * LIVE-OUT: the search-count cell plus the search result in registers.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_67, OBJ_ARRAY_64, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 0x0a;
const SWEEP2_COUNT = 0x05;
const SWEEP3_COUNT = 0x01;
const RECORD_STRIDE = 32;

export function search25mObjectOverlap(m) {
  const { regs, mem8 } = m;

  regs.hl = m.pop16();

  // Sweep 1 — barrel array, 10 records, 32-byte stride (full stride word).
  mem8[OBJ_SEARCH_COUNT] = SWEEP1_COUNT;
  regs.b = SWEEP1_COUNT;
  regs.de = RECORD_STRIDE;
  regs.ix = OBJ_ARRAY_67;
  if (!findCollidingObject(m)) return true;

  // Sweep 2 — five-record array, same stride (low byte only).
  mem8[OBJ_SEARCH_COUNT] = SWEEP2_COUNT;
  regs.b = SWEEP2_COUNT;
  regs.e = 0x20;
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true;

  // Sweep 3 — single record, stride zero.
  mem8[OBJ_SEARCH_COUNT] = SWEEP3_COUNT;
  regs.b = SWEEP3_COUNT;
  regs.e = 0x00;
  regs.ix = OBJ_RECORD_66A0;
  if (!findCollidingObject(m)) return true;

  return true;
}
