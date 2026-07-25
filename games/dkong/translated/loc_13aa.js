// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_13aa  (ROM 0x13AA–0x13BA) — idx 18 small state reset: 0x7D82=(0x6026), 0x600A=0, 0x600D/E=1.
 */
export function loc_13aa(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6026);
  m.step(0x13ad, 13); // ld a,(0x6026)
  mem.write8(0x7d82, regs.a, 7); // ld (0x7d82),a
  m.step(0x13b0, 13);
  regs.xor(regs.a);
  m.step(0x13b1, 4); // xor a
  mem.write8(0x600a, regs.a); // 0x600A = 0
  m.step(0x13b4, 13);
  regs.hl = 0x0101;
  m.step(0x13b7, 10); // ld hl,0x0101
  mem.write16(0x600d, regs.hl); // 0x600D=1, 0x600E=1
  m.step(0x13ba, 16);
  m.ret();
}
