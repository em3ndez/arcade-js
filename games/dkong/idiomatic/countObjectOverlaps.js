// SPDX-License-Identifier: GPL-3.0-only
/**
 * countObjectOverlaps — count how many objects in an array overlap a probe point, within a
 * per-object rectangular window, bumping OVERLAP_COUNT once per overlapping record.
 *
 * Inputs are register live-ins: objectBase (record-array base), probeBase (the other point's
 * record; its field +3 is the second-axis coordinate), count (records to scan; 0 means 256),
 * probeA (first-axis coordinate), stride (per-record byte stride), threshA / threshB (window
 * half-widths).
 *
 * LIVE-OUT: memory-only — the shared overlap counter.
 */

import { u16 } from "../../../core/int.js";
import { OVERLAP_COUNT, OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";

export function countObjectOverlaps(m, { objectBase, probeBase, count, probeA, stride, threshA, threshB }) {
  const { mem8 } = m;

  let base = u16(objectBase);
  let remaining = count & 0xff;        // decrement-then-test, so 0 means 256
  const probeYAddr = u16(probeBase + 0x03);
  const a = probeA & 0xff;
  const tA = threshA & 0xff;
  const tB = threshB & 0xff;

  do {
    // Field +0 bit0 = active flag; inactive records are advanced past.
    if (mem8[base] & 0x01) {
      const ref = mem8[u16(base + 0x05)];
      let d = (a - ref) & 0xff;
      if (a < ref) d = (0 - d) & 0xff;     // negate on borrow -> unsigned distance
      d = (d + 1) & 0xff;

      let overlapsAxis1;
      if (d < tA) {
        overlapsAxis1 = true;
      } else {
        const rem = (d - tA) & 0xff;
        overlapsAxis1 = rem < mem8[u16(base + OBJ_HIT_EXTENT_Y)];
      }

      if (overlapsAxis1) {
        const ref2 = mem8[u16(base + 0x03)];
        const p2 = mem8[probeYAddr];
        let e = (p2 - ref2) & 0xff;
        if (p2 < ref2) e = (0 - e) & 0xff;  // negate on borrow -> unsigned distance

        let overlapsAxis2;
        if (e < tB) {
          overlapsAxis2 = true;
        } else {
          const rem2 = (e - tB) & 0xff;
          overlapsAxis2 = rem2 < mem8[u16(base + OBJ_HIT_EXTENT_X)];
        }

        if (overlapsAxis2) {
          mem8[OVERLAP_COUNT] = (mem8[OVERLAP_COUNT] + 1);
        }
      }
    }

    base = u16(base + stride);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);
}
