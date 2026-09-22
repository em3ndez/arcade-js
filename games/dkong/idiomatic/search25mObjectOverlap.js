// SPDX-License-Identifier: GPL-3.0-only
/**
 * search25mObjectOverlap — the barrel board's collision arm. Runs three back-to-back bounding-box
 * sweeps, stamping each sweep's record count into OBJ_SEARCH_COUNT and pointing the shared search at
 * a different object array; the first overlap stops the later sweeps. Returns the search outcome:
 * { overlap, residue, stride, base } (residue is the count-minus-index the hit handler reads). The
 * reference point (iy/c) and per-axis tolerances (bounds) arrive as arguments.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory; the search outcome is returned.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_67, OBJ_ARRAY_64, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

const SWEEP1_COUNT = 0x0a;
const SWEEP2_COUNT = 0x05;
const SWEEP3_COUNT = 0x01;
const RECORD_STRIDE = 32;

export function search25mObjectOverlap(m, { iy, c, bounds }) {
  const { mem8 } = m;
  const tolLow = bounds & 0xff;
  const tolHigh = bounds >> 8;

  mem8[OBJ_SEARCH_COUNT] = SWEEP1_COUNT;
  let r = findCollidingObject(m, OBJ_ARRAY_67, c, tolLow, iy, tolHigh, RECORD_STRIDE, SWEEP1_COUNT);
  if (r.hit) return { overlap: r.a, residue: r.b, stride: RECORD_STRIDE, base: OBJ_ARRAY_67 };

  mem8[OBJ_SEARCH_COUNT] = SWEEP2_COUNT;
  r = findCollidingObject(m, OBJ_ARRAY_64, c, tolLow, iy, tolHigh, RECORD_STRIDE, SWEEP2_COUNT);
  if (r.hit) return { overlap: r.a, residue: r.b, stride: RECORD_STRIDE, base: OBJ_ARRAY_64 };

  mem8[OBJ_SEARCH_COUNT] = SWEEP3_COUNT;
  r = findCollidingObject(m, OBJ_RECORD_66A0, c, tolLow, iy, tolHigh, 0, SWEEP3_COUNT);
  return { overlap: r.a, residue: r.b, stride: 0, base: OBJ_RECORD_66A0 };
}
