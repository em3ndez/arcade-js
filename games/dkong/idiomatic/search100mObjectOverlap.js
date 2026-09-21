// SPDX-License-Identifier: GPL-3.0-only
/**
 * search100mObjectOverlap — run one bounding-box collision sweep over OBJ_ARRAY_64, the hazard
 * array 100m uses. Recovers the caller's pushed per-axis tolerances, records the sweep count where
 * the found-handler reads it back, then scans for the first record whose box overlaps the reference.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory, plus the search result the dispatch caller consumes.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP_COUNT = 7;
const RECORD_STRIDE = 32;

export function search100mObjectOverlap(m) {
  const { regs, mem8 } = m;

  mem8[OBJ_SEARCH_COUNT] = SWEEP_COUNT;

  return (regs.hl = m.pop16(), regs.b = SWEEP_COUNT, regs.de = RECORD_STRIDE, regs.ix = OBJ_ARRAY_64, findCollidingObject(m), true);
}
