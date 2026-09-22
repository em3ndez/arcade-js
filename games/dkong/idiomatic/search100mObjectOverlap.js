// SPDX-License-Identifier: GPL-3.0-only
/**
 * search100mObjectOverlap — run one bounding-box collision sweep over OBJ_ARRAY_64, the hazard array
 * 100m uses. Stamps the sweep count where the found-handler reads it back, then scans for the first
 * record whose box overlaps the reference. Returns the search outcome { overlap, residue, stride, base };
 * the reference point (iy/c) and per-axis tolerances (bounds) arrive as arguments.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory; the search outcome is returned.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP_COUNT = 7;
const RECORD_STRIDE = 32;

export function search100mObjectOverlap(m, { iy, c, bounds }) {
  const { mem8 } = m;
  const tolLow = bounds & 0xff;
  const tolHigh = bounds >> 8;

  mem8[OBJ_SEARCH_COUNT] = SWEEP_COUNT;
  const r = findCollidingObject(m, OBJ_ARRAY_64, c, tolLow, iy, tolHigh, RECORD_STRIDE, SWEEP_COUNT);
  return { overlap: r.a, residue: r.b, stride: RECORD_STRIDE, base: OBJ_ARRAY_64 };
}
