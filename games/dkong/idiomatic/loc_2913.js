// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2913 — scan an object list for the first record whose bounding box overlaps a
 * reference point on both axes; stop and report a hit, or report the list exhausted.  ROM 0x2913.
 *
 * A collision primitive. The board collision handlers point it at one of their object
 * arrays and hand it a reference coordinate pair (in practice Mario's position) plus a
 * per-axis base tolerance; it walks the array and, for each ACTIVE record, tests whether
 * the reference point falls inside that record's box:
 *
 *   axis 1: | refA - record[+5] | + 1  must land inside a window of (baseA) OR, past that,
 *           inside the record's own extra span record[+0x0A].
 *   axis 2: | refB - record[+3] |      must land inside a window of (baseB) OR, past that,
 *           inside the record's own extra span record[+0x09].
 *
 * A record whose flag byte (+0) has bit 0 clear is inactive and skipped. A record that
 * fails either axis is skipped. The FIRST record that passes both axes is a hit: the scan
 * stops there. If no record passes, the list is exhausted.
 *
 * CALLER-SKIP RETURN (the shared rst-0x08 / m.call convention). On a hit the ROM discards
 * its own return address and returns one level FURTHER up — so the immediate caller's
 * post-call code is skipped and its caller resumes. That control effect is expressed here
 * as the boolean return the callers already branch on with `if (!loc_2913(m)) return...`:
 *   • returns TRUE  — list exhausted, no hit (the ROM's normal return, result byte 0).
 *   • returns FALSE — a hit was found (the ROM's caller-skip return, result byte 1).
 *
 * REGISTER ABI. This is a raw primitive still called from the translated layer through
 * registers, so it reads its inputs from and leaves its outputs in registers (no honest
 * JS params yet — that waits until the callers are decompiled):
 *   live-in : IX  record base address        L  axis-1 base tolerance
 *             DE  record stride (bytes)       H  axis-2 base tolerance
 *             B   record count / loop count   IY  reference-point pointer; +3 = axis-2 ref
 *             C   axis-1 reference coordinate
 *   live-out: A   1 on a hit, 0 on exhaustion (mirrored by the boolean return)
 *             B   on a hit, count minus the matched record's index — the caller recovers
 *                 that index as (count - B); 0 on exhaustion. IX is preserved.
 * IX is walked on a local copy so the caller's IX register is left untouched (the ROM
 * saves and restores it around the scan). B==0 on entry is not guarded, so it scans 256
 * records, exactly as the ROM does.
 *
 * A LEAF: reads only the object records (via the base pointer) and the reference byte
 * (via the reference pointer); calls nothing; writes no work RAM.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2913.test.js.
 * GATE:     a broad randomised sweep of record layouts / counts / strides / reference
 *           coordinates comparing RAM (minus the dead STACK_SCRATCH the oracle's IX
 *           save/restore and caller-skip return churn there), pc, SP and the full register
 *           file against the oracle; targeted crafted cases pinning each arm (inactive
 *           slot, both per-axis windows and their extra-span accept/reject arms, both
 *           absolute-difference directions, a hit at a nonzero index for the count-minus-B
 *           recovery, and the unguarded 256-record scan); plus real captured 0x2913
 *           dispatches from an attract run (both the exhausted and hit outcomes occur).
 * LIVE-OUT: registers A and B (see ABI) plus the boolean return; no work RAM is written.
 *           The oracle's IX save/restore and its one- or two-level return are stack-only,
 *           so their bytes land in STACK_SCRATCH and are excluded from the memory compare.
 * NAMES:    none from ram.js — every memory read is indexed through the caller-supplied
 *           base/reference registers (no fixed named cell), so the record field offsets
 *           stay as literals with role comments.
 */

export function loc_2913(m) {
  const { regs, mem } = m;

  // Walk a LOCAL copy of the record base so the caller's IX is preserved.
  let rec = regs.ix;

  for (;;) {
    let hit = false;

    // Every "not a match" test drops to the advance step below, mirroring the ROM's
    // single shared 0x294C fall-through target.
    record: {
      // Active-slot test: bit 0 of the record's flag byte (+0). The undocumented F3/F5
      // flags take the effective-address high byte, not the byte read (the indexed form).
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
        regs.sub(mem.read8((rec + 0x0a) & 0xffff));
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
        regs.sub(mem.read8((rec + 0x09) & 0xffff));
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
