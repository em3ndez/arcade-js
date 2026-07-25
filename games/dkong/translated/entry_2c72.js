// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2c72  (ROM 0x2C72–0x2C7A) — set bit 7 of 0x6382.
 *
 *   2c72  3a 82 63     ld   a,(0x6382)
 *   2c75  f6 80        or   0x80
 *   2c77  32 82 63     ld   (0x6382),a
 *   2c7a  c9           ret
 */
export function entry_2c72(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6382);
  m.step(0x2c75, 13); // ld a,(0x6382)
  regs.or(0x80); // or 0x80 -- set bit 7, low bits preserved
  m.step(0x2c77, 7);
  mem.write8(0x6382, regs.a);
  m.step(0x2c7a, 13); // ld (0x6382),a
  m.ret(); // ret (0x2C7A)
}
