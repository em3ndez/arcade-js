// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_196b  (ROM 0x196B–0x1976) — (0x600A) phase arm at index 23 (word 0x196B @0x0730 of the 0x0702.
 * table). ROM 0x196B-0x1977.
 * Runs sub_0852 (INTEGRATED), then jumps the master phase byte
 * (0x600A) to (0x600E)+0x12 -- a computed transition into the next phase group. Do
 * not fold the 0x12 base offset.
 */
export function loc_196b(m) {
  const { regs, mem } = m;
  m.push16(0x196e);
  m.step(0x0852, 17); // call 0x0852 (INTEGRATED)
  m.call(0x0852);
  regs.a = mem.read8(0x600e);
  m.step(0x1971, 13); // ld a,(0x600e) -- level/screen selector
  regs.add(0x12);
  m.step(0x1973, 7); // add a,0x12
  mem.write8(0x600a, regs.a);
  m.step(0x1976, 13); // ld (0x600a),a -- (0x600A) := (0x600E) + 0x12
  m.ret(10);
}
