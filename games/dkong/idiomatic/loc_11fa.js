// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_11fa — scatter a six-byte source record into a fixed record plus a four-byte array.
 *
 * A straight-line struct initialiser: no branches, no calls. It reads SIX consecutive bytes from a
 * caller-supplied source pointer and stamps them into two fixed destinations, neither of which is
 * derived from the input:
 *
 *   - A scattered-field record. Its first field is set to the constant tag 1; the six source bytes
 *     then land at fields +3, +7, +8, +5, +9, +10 — an out-of-order sequence in which +5 is
 *     written after +8. All seven targets are distinct addresses, so the scramble changes nothing
 *     about the memory this leaves behind; only a write trace could see it. The order is
 *     reproduced anyway.
 *   - A four-byte contiguous array holding the FIRST FOUR source bytes only; bytes 4 and 5 are not
 *     mirrored there. That array sits inside the sprite shadow buffer, which makes a sprite record
 *     the likely reading, but nothing here establishes it.
 *
 * NOT CLAIMED: what any of the record's fields mean. Nothing observed reads them back, and whether
 * the untouched fields +1, +2, +4 and +6 are padding, written by something else, or unused is
 * open.
 *
 * LIVE-OUT: memory-only — the eleven bytes written.
 */
export function loc_11fa(m) {
  const { regs, mem } = m;

  // Both destinations are fixed constants — never derived from the input.
  const REC = 0x66a0; // the scattered-field record
  const ARR = 0x6a28; // the 4-byte contiguous array, inside the sprite shadow buffer

  // The source pointer is the caller's; read six consecutive bytes from it.
  const src = regs.hl;
  const b0 = mem.read8((src + 0) & 0xffff);
  const b1 = mem.read8((src + 1) & 0xffff);
  const b2 = mem.read8((src + 2) & 0xffff);
  const b3 = mem.read8((src + 3) & 0xffff);
  const b4 = mem.read8((src + 4) & 0xffff);
  const b5 = mem.read8((src + 5) & 0xffff);

  // Record: a constant tag in the first field, then the six bytes scattered into their
  // out-of-order field sequence (+0x05 lands after +0x08 — distinct addresses, so the memory
  // left behind is order-independent).
  mem.write8(REC + 0x00, 0x01);
  mem.write8(REC + 0x03, b0);
  mem.write8(REC + 0x07, b1);
  mem.write8(REC + 0x08, b2);
  mem.write8(REC + 0x05, b3);
  mem.write8(REC + 0x09, b4);
  mem.write8(REC + 0x0a, b5);

  // Array: the FIRST FOUR source bytes only (b4/b5 are not mirrored here).
  mem.write8(ARR + 0, b0);
  mem.write8(ARR + 1, b1);
  mem.write8(ARR + 2, b2);
  mem.write8(ARR + 3, b3);
}
