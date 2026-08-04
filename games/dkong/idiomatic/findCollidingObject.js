// SPDX-License-Identifier: GPL-3.0-only
/**
 * findCollidingObject — scan an object list for the first record whose bounding box overlaps a
 * reference point on both axes; stop and report a hit, or report the list exhausted.
 *
 * A collision primitive. A board collision handler points it at one of its object arrays and
 * hands it a reference coordinate pair — in practice Mario's position — plus a per-axis base
 * tolerance. It walks the array and, for each ACTIVE record, tests whether the reference point
 * falls inside that record's box:
 *
 *   axis 1: | reference − record[+5] | + 1  must land inside the base window OR, past that,
 *           inside the record's own extra span at OBJ_HIT_EXTENT_Y.
 *   axis 2: | reference − record[+3] |      must land inside the base window OR, past that,
 *           inside the record's own extra span at OBJ_HIT_EXTENT_X.
 *
 * A record whose flag byte (+0) has bit 0 clear is inactive and skipped. A record that fails
 * either axis is skipped. The FIRST record that passes both axes is a hit: the scan stops
 * there. If no record passes, the list is exhausted.
 *
 * CALLER-SKIP RETURN. On a hit the immediate caller's post-call code is skipped and its own
 * caller resumes. That control effect is expressed here as the boolean the callers branch on:
 *   • TRUE  — list exhausted, no hit.
 *   • FALSE — a hit was found, so the caller must not continue.
 *
 * REGISTER-PASSED, BOTH WAYS. This is a raw primitive its callers still reach through the
 * register image, so it reads its inputs from there and leaves its outputs there:
 *   live-in : the record base, the record stride in bytes, the record count, the
 *             reference-point pointer (whose +3 byte is the axis-2 reference), the axis-1
 *             reference coordinate, and the two per-axis base tolerances.
 *   live-out: the result byte — 1 on a hit, 0 on exhaustion, mirroring the boolean — and, on
 *             a hit, the count minus the matched record's index, from which the caller
 *             recovers that index.
 * The base is walked on a local copy, so the caller's own base register comes back untouched.
 * A count of zero on entry is NOT guarded: it scans 256 records, faithfully.
 *
 * A LEAF: it reads only the object records, through the base pointer, and one reference byte,
 * through the reference pointer; it calls nothing and writes no work RAM.
 *
 * LIVE-OUT: the two result registers and the boolean; no memory.
 */

import { OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";

export function findCollidingObject(m) {
  const { regs, mem } = m;

  // Walk a LOCAL copy of the record base so the caller's own base register is preserved.
  let rec = regs.ix;

  for (;;) {
    let hit = false;

    // Every "not a match" test drops to the advance step below — one shared exit.
    record: {
      // Active-slot test: bit 0 of the record's flag byte (+0). The undocumented flag bits
      // this leaves behind come from the address's high byte, not from the byte read.
      const ea = rec & 0xffff;
      regs.bit(0, mem.read8(ea), (ea >> 8) & 0xff);
      if (regs.fZ) break record; // inactive slot -> next record

      // Axis 1: absolute difference between the reference coordinate and record[+5],
      // plus one, then brought inside the base tolerance window.
      regs.a = regs.c;
      regs.sub(mem.read8((rec + 0x05) & 0xffff));
      if (!regs.fNC) regs.neg(); // |refA - record[+5]|
      regs.a = regs.inc8(regs.a); // +1 (half-open window)
      regs.sub(regs.l);
      if (!regs.fC) {
        // Beyond the base window: in range only if inside the record's own extra span.
        regs.sub(mem.read8((rec + OBJ_HIT_EXTENT_Y) & 0xffff));
        if (regs.fNC) break record; // out of range on axis 1 -> next record
      }

      // Axis 2: absolute difference between the reference byte (+3 of the reference
      // pointer) and record[+3], brought inside the base tolerance window.
      regs.a = mem.read8((regs.iy + 0x03) & 0xffff);
      regs.sub(mem.read8((rec + 0x03) & 0xffff));
      if (!regs.fNC) regs.neg(); // |refB - record[+3]|
      regs.sub(regs.h);
      if (!regs.fC) {
        // Beyond the base window: in range only if inside the record's own extra span.
        regs.sub(mem.read8((rec + OBJ_HIT_EXTENT_X) & 0xffff));
        if (regs.fNC) break record; // out of range on axis 2 -> next record
      }

      hit = true; // both axes overlap -> this record is the hit
    }

    if (hit) {
      regs.a = 0x01; // result byte 1
      return false; // caller-skip return (a hit was found)
    }

    // Advance to the next record and continue while any remain.
    rec = (rec + regs.de) & 0xffff;
    regs.djnz();
    if (regs.b === 0) break; // list exhausted
  }

  regs.xor(regs.a); // result byte 0
  return true; // normal return (list exhausted, no hit)
}
