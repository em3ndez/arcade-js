// SPDX-License-Identifier: GPL-3.0-only
/**
 * search50mObjectOverlap — the conveyor board's collision arm. Runs three back-to-back bounding-box
 * sweeps, stamping each sweep's record count into OBJ_SEARCH_COUNT and pointing the shared search at
 * a different object array; the first overlap stops the later sweeps. Returns the search outcome
 * { overlap, residue, stride, base }; the reference point (iy/c) and tolerances (bounds) are args.
 *
 * LIVE-OUT: OBJ_SEARCH_COUNT in memory; the search outcome is returned.
 */

import { OBJ_SEARCH_COUNT, OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJ_RECORD_66A0 } from "./names.js";
import { findCollidingObject } from "./findCollidingObject.js";

export function search50mObjectOverlap(m, { iy, c, bounds }) {
  const { mem8 } = m;
  const tolLow = bounds & 0xff;
  const tolHigh = bounds >> 8;

  mem8[OBJ_SEARCH_COUNT] = 0x05;
  let r = findCollidingObject(m, OBJ_ARRAY_64, c, tolLow, iy, tolHigh, 32, 0x05);
  if (r.hit) return { overlap: r.a, residue: r.b, stride: 32, base: OBJ_ARRAY_64 };

  mem8[OBJ_SEARCH_COUNT] = 0x06;
  r = findCollidingObject(m, OBJ_ARRAY_65A0, c, tolLow, iy, tolHigh, 16, 0x06);
  if (r.hit) return { overlap: r.a, residue: r.b, stride: 16, base: OBJ_ARRAY_65A0 };

  mem8[OBJ_SEARCH_COUNT] = 0x01;
  r = findCollidingObject(m, OBJ_RECORD_66A0, c, tolLow, iy, tolHigh, 0, 0x01);
  return { overlap: r.a, residue: r.b, stride: 0, base: OBJ_RECORD_66A0 };
}
