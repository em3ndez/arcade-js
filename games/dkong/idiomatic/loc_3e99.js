// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3e99 — the 25m arm of the board-overlap search: count how many hazards crowd a probe point
 * near Mario and grade the total into a unary mask — 0 / 1 / 2 / 3-or-more overlaps become
 * 0 / 1 / 3 / 7 (that many low bits set), which the caller walks one bit at a time to pick effect
 * setters. Scans OBJ_ARRAY_67 (10 records) then OBJ_ARRAY_64 (5) at a 32-byte stride, sharing one
 * counter so the code grades the total across both.
 *
 * LIVE-OUT: OVERLAP_COUNT in memory, plus the graded code, both returned and left in A for the
 * caller chain.
 */

import { OVERLAP_COUNT, OBJ_ARRAY_67, OBJ_ARRAY_64 } from "./names.js";
import { countObjectOverlaps } from "./countObjectOverlaps.js";

const GROUP1_RECORDS = 10;
const GROUP2_RECORDS = 5;
const RECORD_STRIDE = 32;

export function loc_3e99(m, iyBase = m.regs.iy, cProbe = m.regs.c) {
  const { regs, mem8 } = m;

  // Bounds word stacked across the trampoline: low byte = vertical, high byte = horizontal tolerance.
  const bounds = m.pop16();
  const verticalTolerance = bounds & 0xff;
  const horizontalTolerance = bounds >> 8;

  mem8[OVERLAP_COUNT] = 0; // both scans accumulate into this

  const probe = {
    probeBase: iyBase, // Mario's record
    probeA: cProbe, // vertical coordinate: MARIO_Y a dozen pixels lower
    stride: RECORD_STRIDE,
    threshA: verticalTolerance,
    threshB: horizontalTolerance,
  };
  countObjectOverlaps(m, { ...probe, objectBase: OBJ_ARRAY_67, count: GROUP1_RECORDS });
  countObjectOverlaps(m, { ...probe, objectBase: OBJ_ARRAY_64, count: GROUP2_RECORDS });

  const overlaps = mem8[OVERLAP_COUNT];
  let code;
  if (overlaps === 0) code = 0;
  else if (overlaps === 1) code = 1;
  else if (overlaps < 3) code = 3;
  else code = 7;

  regs.a = code;
  return code;
}
