// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_13bb  (ROM 0x13BB–0x13C9) — idx 19 small state reset: 0x600D/E/A=0, 0x7D82=1.
 */
export function loc_13bb(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x13bc, 4); // xor a
  mem.write8(0x600d, regs.a);
  m.step(0x13bf, 13); // ld (0x600d),a
  mem.write8(0x600e, regs.a);
  m.step(0x13c2, 13); // ld (0x600e),a
  mem.write8(0x600a, regs.a);
  m.step(0x13c5, 13); // ld (0x600a),a
  regs.a = regs.inc8(regs.a);
  m.step(0x13c6, 4); // inc a
  mem.write8(0x7d82, regs.a, 7); // ld (0x7d82),a = 1
  m.step(0x13c9, 13);
  m.ret();
}
