// SPDX-License-Identifier: GPL-3.0-only
/**
 * search75mObjectOverlap — the 75m board's collision arm: run the shared bounding-box search over two
 * object arrays in turn, stamping each sweep's record count into OBJ_SEARCH_COUNT and stopping at the
 * first hit. Returns the search outcome { overlap, residue, stride, base }; the reference point (iy/c)
 * and per-axis tolerances (bounds) arrive as arguments.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory; the search outcome is returned.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 5;
const SWEEP1_STRIDE = 0x20;
const SWEEP2_COUNT = 10;
const SWEEP2_STRIDE = 0x10;

export function search75mObjectOverlap(m, { iy, c, bounds }) {
  const { mem8 } = m;
  const tolLow = bounds & 0xff;
  const tolHigh = bounds >> 8;

  mem8[OBJ_SEARCH_COUNT] = SWEEP1_COUNT;
  let r = findCollidingObject(m, OBJ_ARRAY_64, c, tolLow, iy, tolHigh, SWEEP1_STRIDE, SWEEP1_COUNT);
  if (r.hit) return { overlap: r.a, residue: r.b, stride: SWEEP1_STRIDE, base: OBJ_ARRAY_64 };

  mem8[OBJ_SEARCH_COUNT] = SWEEP2_COUNT;
  r = findCollidingObject(m, OBJ_ARRAY_65, c, tolLow, iy, tolHigh, SWEEP2_STRIDE, SWEEP2_COUNT);
  return { overlap: r.a, residue: r.b, stride: SWEEP2_STRIDE, base: OBJ_ARRAY_65 };
}
