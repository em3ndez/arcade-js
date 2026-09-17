// SPDX-License-Identifier: GPL-3.0-only
/**
 * search50mObjectOverlap — the conveyor board's collision arm. Recovers the per-axis search
 * tolerances the dispatcher pushed, then runs three back-to-back bounding-box sweeps, stamping
 * each sweep's record count into OBJ_SEARCH_COUNT and pointing the shared search at a different
 * object array; the first overlap takes a caller-skip return that abandons the later sweeps.
 * The stride's high byte stays zero, so sweeps 2 and 3 reload only its low byte.
 *
 * LIVE-OUT: the search-count cell plus the search result the dispatch caller consumes.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function search50mObjectOverlap(m) {
  const { regs, mem8 } = m;

  regs.hl = m.pop16();

  // Sweep 1 — five-record array, 32-byte stride (full stride word).
  mem8[OBJ_SEARCH_COUNT] = 0x05;
  regs.b = 0x05;
  regs.de = 0x0020;
  regs.ix = OBJ_ARRAY_64;
  if (!findCollidingObject(m)) return true;

  // Sweep 2 — this board's mover array, 16-byte stride, 6 records (low byte only).
  mem8[OBJ_SEARCH_COUNT] = 0x06;
  regs.b = 0x06;
  regs.e = 0x10;
  regs.ix = OBJ_ARRAY_65A0;
  if (!findCollidingObject(m)) return true;

  // Sweep 3 — single record, stride zero.
  mem8[OBJ_SEARCH_COUNT] = 0x01;
  regs.b = 0x01;
  regs.e = 0x00;
  regs.ix = OBJ_RECORD_66A0;
  if (!findCollidingObject(m)) return true;

  return true;
}
