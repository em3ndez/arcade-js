// SPDX-License-Identifier: GPL-3.0-only
/**
 * findCollidingObject — scan an object list for the first record whose bounding box overlaps a
 * reference point on both axes; stop and report a hit, or report the list exhausted. A leaf
 * collision primitive: inactive records (flag +0 bit0 clear) are skipped, and each axis passes
 * inside the caller's base tolerance window or the record's own extra span. Inputs and outputs are
 * register-carried and it writes no memory; the returned boolean is inverted (see below).
 *
 * LIVE-OUT: the two result registers and the boolean; no memory.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";

export function findCollidingObject(
  m,
  ix = m.regs.ix,
  c = m.regs.c,
  l = m.regs.l,
  iy = m.regs.iy,
  h = m.regs.h,
  de = m.regs.de,
) {
  const { regs, mem8 } = m;

  // Walk a local copy of the base so the caller's own base register is preserved.
  let rec = ix;

  for (;;) {
    let hit = false;

    record: {
      const ea = u16(rec);
      regs.bit(0, mem8[ea], (ea >> 8) & 0xff);
      if (regs.fZ) break record; // inactive slot -> next record

      // Axis 1: |ref - record[+5]| + 1, inside the base window or the record's extra span.
      regs.a = c;
      regs.sub(mem8[u16(rec + 0x05)]);
      if (!regs.fNC) regs.neg();
      regs.a = regs.inc8(regs.a);
      regs.sub(l);
      if (!regs.fC) {
        regs.sub(mem8[u16(rec + OBJ_HIT_EXTENT_Y)]);
        if (regs.fNC) break record; // out of range on axis 1 -> next record
      }

      // Axis 2: |ref[+3] - record[+3]|, inside the base window or the record's extra span.
      regs.a = mem8[u16(iy + 0x03)];
      regs.sub(mem8[u16(rec + 0x03)]);
      if (!regs.fNC) regs.neg();
      regs.sub(h);
      if (!regs.fC) {
        regs.sub(mem8[u16(rec + OBJ_HIT_EXTENT_X)]);
        if (regs.fNC) break record; // out of range on axis 2 -> next record
      }

      hit = true;
    }

    if (hit) {
      regs.a = 0x01;
      return false; // FALSE = a hit was found (caller-skip)
    }

    rec = u16(rec + de);
    regs.djnz();
    if (regs.b === 0) break;
  }

  regs.xor(regs.a);
  return true; // TRUE = list exhausted, no hit
}
