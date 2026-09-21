// SPDX-License-Identifier: GPL-3.0-only
/**
 * findCollidingObject — scan an object list for the first record whose bounding box overlaps a
 * reference point on both axes; stop and report a hit, or report the list exhausted. A leaf
 * collision primitive: inactive records (flag +0 bit0 clear) are skipped, and each axis passes
 * inside the caller's base tolerance window or the record's own extra span. It writes no memory;
 * the returned boolean is inverted (see below).
 *
 * LIVE-OUT: A (1 on a hit, 0 exhausted), B (count-minus-index residue the hit-handler reads), the
 * flag byte, and the boolean; no memory. Axis 1's arithmetic leaves no live flag (axis 2 or the exit
 * `xor a` always overwrites it), so it is plain JS; axis 2's surviving-flag exit — the hit — is kept
 * on the real Z80 subtractions so the outgoing flag byte stays bit-exact.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";

export function findCollidingObject(m, ix = m.regs.ix, c = m.regs.c, l = m.regs.l, iy = m.regs.iy, h = m.regs.h, de = m.regs.de) {
  const { regs, mem8 } = m;

  // Walk a local copy of the base so the caller's own base register is preserved.
  let rec = ix;

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

      // Axis 2: |ref[+3] - record[+3]|, inside the base window or the record's extra span. The hit
      // exit's live flag byte comes from these subtractions, so they stay on the Z80 ALU.
      regs.a = Math.abs(mem8[u16(iy + 0x03)] - mem8[u16(rec + 0x03)]);
      regs.sub(h);
      if (!regs.fC) {
        regs.sub(mem8[u16(rec + OBJ_HIT_EXTENT_X)]);
        if (regs.fNC) break record; // out of range on axis 2 -> next record
      }

      hit = true;
    }

    if (hit) {
      return (m.regs.a = 0x01, false); // FALSE = a hit was found (caller-skip)
    }

    rec = u16(rec + de);
    if (regs.djnz() === 0) break; // decrement the count (live-out B) and stop when exhausted
  }

  regs.xor(regs.a);
  return true; // TRUE = list exhausted, no hit
}
