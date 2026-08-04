// SPDX-License-Identifier: GPL-3.0-only
/**
 * countObjectOverlaps — count how many objects in an array overlap a probe point, within a
 * per-object rectangular window.  ROM 0x3EC3.
 *
 * Walks `count` fixed-stride records starting at objectBase (stride bytes apart). Each
 * record whose field +0 has bit0 clear is INACTIVE and skipped. For an active record it
 * runs a two-axis rectangular-overlap test of the probe point against the record's own
 * reference position and its per-record window half-widths:
 *
 *   - First axis: the absolute distance between probeA and the record's field +5. The
 *     record overlaps on this axis when that distance plus one is under threshA, or (past
 *     threshA) still under the record's field +0x0a window. If it does not overlap on the
 *     first axis the record is skipped.
 *   - Second axis (only when the first overlapped): the absolute distance between the
 *     probe point's second coordinate (probeBase's field +3) and the record's field +3.
 *     The record overlaps on this axis when that distance is under threshB, or (past
 *     threshB) still under the record's field +9 window.
 *
 * When BOTH axes overlap it bumps the shared overlap counter OVERLAP_COUNT (0x6060) by one.
 * The caller clears that counter first and reads it back afterwards as an overlap-severity
 * code, so this routine's only observable effect is the counter — it writes nothing else.
 *
 * Both "absolute distance" steps are the subtract-then-negate-on-borrow idiom: subtract,
 * and only when that borrowed, negate — yielding the unsigned distance without a signed
 * compare. Each subtraction is a byte operation and its borrow drives the branch exactly as
 * the frozen oracle's carry flag does.
 *
 * Inputs (register live-ins the oracle consumes): objectBase = the record-array base;
 * probeBase = the other point's record (its field +3 is the second-axis coordinate);
 * count = number of records to scan (0 scans 256, matching the loop's decrement-then-test);
 * probeA = the probe point's first-axis coordinate; stride = per-record byte stride;
 * threshA / threshB = the first- / second-axis window half-widths.
 *
 * Memory-equivalent to the frozen oracle (translated/entry_3ec3.js) — equivalence-3ec3.test.js.
 * LIVE-OUT: memory-only (OVERLAP_COUNT). The oracle's residual registers/flags and its
 * advanced record cursor are dead — the caller reads the counter from RAM, not registers —
 * and its terminal return is the ordinary subroutine return.
 * NAMES: OVERLAP_COUNT (0x6060) from names.js. The record-array bases and the probe base arrive
 * as inputs (the live caller passes 0x6700 ×10 then 0x6400 ×5), and the per-record field
 * offsets (+0/+3/+5/+9/+0x0A) and the probe's +3 field are record-relative — none has a
 * fixed-cell name in names.js, so they stay as base+offset here.
 */

import { OVERLAP_COUNT, OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js"; // 0x6060 — the shared overlap counter this routine bumps

export function countObjectOverlaps(m, { objectBase, probeBase, count, probeA, stride, threshA, threshB }) {
  const { mem } = m;

  let base = objectBase & 0xffff;      // record cursor; advances by `stride` each pass
  let remaining = count & 0xff;        // scan count; decrement-then-test, so 0 means 256
  const probeYAddr = (probeBase + 0x03) & 0xffff; // the probe point's second-axis coordinate
  const a = probeA & 0xff;
  const tA = threshA & 0xff;
  const tB = threshB & 0xff;

  do {
    // Field +0 bit0 = active flag; inactive records are just advanced past.
    if (mem.read8(base) & 0x01) {
      // First axis: |probeA - field+5|, then +1.
      const ref = mem.read8((base + 0x05) & 0xffff);
      let d = (a - ref) & 0xff;
      if (a < ref) d = (0 - d) & 0xff;     // negate on borrow -> unsigned distance
      d = (d + 1) & 0xff;

      // Overlap on the first axis: under threshA, or (past it) under field+0x0A.
      let overlapsAxis1;
      if (d < tA) {
        overlapsAxis1 = true;
      } else {
        const rem = (d - tA) & 0xff;
        overlapsAxis1 = rem < mem.read8((base + OBJ_HIT_EXTENT_Y) & 0xffff);
      }

      if (overlapsAxis1) {
        // Second axis: |probeBase's field+3  -  field+3|.
        const ref2 = mem.read8((base + 0x03) & 0xffff);
        const p2 = mem.read8(probeYAddr);
        let e = (p2 - ref2) & 0xff;
        if (p2 < ref2) e = (0 - e) & 0xff;  // negate on borrow -> unsigned distance

        // Overlap on the second axis: under threshB, or (past it) under field+9.
        let overlapsAxis2;
        if (e < tB) {
          overlapsAxis2 = true;
        } else {
          const rem2 = (e - tB) & 0xff;
          overlapsAxis2 = rem2 < mem.read8((base + OBJ_HIT_EXTENT_X) & 0xffff);
        }

        if (overlapsAxis2) {
          // Both axes overlap: count it.
          mem.write8(OVERLAP_COUNT, (mem.read8(OVERLAP_COUNT) + 1) & 0xff);
        }
      }
    }

    base = (base + stride) & 0xffff;
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);
}
