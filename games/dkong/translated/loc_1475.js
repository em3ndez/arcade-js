// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1475  (ROM 0x1475–0x1485) — 141E interior: neither found -> flip 0x7D82, clear 0x600A.
 */
export function loc_1475(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x1477, 7); // ld a,0x01
  mem.write8(0x7d82, regs.a); // HARDWARE WRITE = 1
  m.step(0x147a, 13);
  mem.write8(0x6005, regs.a);
  m.step(0x147d, 13);
  mem.write8(0x6007, regs.a);
  m.step(0x1480, 13);
  regs.a = 0x00;
  m.step(0x1482, 7); // ld a,0x00
  mem.write8(0x600a, regs.a);
  m.step(0x1485, 13);
  m.ret(10); // ret (0x1485)
}
