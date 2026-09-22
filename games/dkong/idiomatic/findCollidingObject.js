// SPDX-License-Identifier: GPL-3.0-only
/**
 * findCollidingObject — scan an object list for the first record whose bounding box overlaps a
 * reference point on both axes; stop and report a hit, or report the list exhausted. A leaf
 * collision primitive: inactive records (flag +0 bit0 clear) are skipped, and each axis passes
 * inside the caller's base tolerance window or the record's own extra span. It writes no memory.
 * Returns `{ hit, a, b }` (a/b mirror the regs.a/regs.b writes). LIVE-OUT: A (1 hit / 0 exhausted),
 * B (count-minus-index residue the hit-handler reads); no memory. The outgoing flag byte is DEAD:
 * every consumer re-derives its branch from A or B and none reads the flags, so both axes are plain
 * JS with no Z80 ALU op.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";

export function findCollidingObject(m, ix = m.regs.ix, c = m.regs.c, l = m.regs.l, iy = m.regs.iy, h = m.regs.h, de = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  // Walk a local copy of the base so the caller's own base register is preserved.
  let rec = ix;
  // Records left to scan; its running value is the count-minus-index residue left in B on exit.
  let remaining = count;

  for (;;) {
    let hit = false;

    record: {
      const ea = u16(rec);
      if ((mem8[ea] & 0x01) === 0) break record; // inactive slot -> next record

      // Axis 1: |ref - record[+5]| + 1, inside the base window or the record's extra span.
      const w = (Math.abs(c - mem8[u16(rec + 0x05)]) + 1) & 0xff;
      if (w >= l) {
        // Past the base tolerance -> must fall inside the record's extra span, else out of range.
        if ((w - l) >= mem8[u16(rec + OBJ_HIT_EXTENT_Y)]) break record;
      }

      // Axis 2: |ref[+3] - record[+3]|, inside the base window or the record's extra span.
      const wy = Math.abs(mem8[u16(iy + 0x03)] - mem8[u16(rec + 0x03)]) & 0xff;
      if (wy >= h) {
        // Past the base tolerance -> must fall inside the record's extra span, else out of range.
        if ((wy - h) >= mem8[u16(rec + OBJ_HIT_EXTENT_X)]) break record;
      }

      hit = true;
    }

    // hit: true = a hit was found (caller-skip); B carries the count-minus-index residue the handler reads.
    if (hit) return (m.regs.b = remaining, m.regs.a = 0x01, { hit: true, a: 0x01, b: remaining });

    rec = u16(rec + de);
    remaining = (remaining - 1) & 0xff; // one record consumed; drains into B on exit
    if (remaining === 0) break;
  }

  return (m.regs.a = 0, m.regs.b = 0, { hit: false, a: 0, b: 0 }); // list exhausted, no hit; A and B drained to 0
}
