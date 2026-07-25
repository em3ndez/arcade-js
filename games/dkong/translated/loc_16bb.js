// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_16bb  (ROM 0x16BB–0x1707) — board load variant: 0x62A0 flag by (0x6910) vs 0x5A/0x5D + bit7(0x63A3); call 0x2602 / reinit.
 */
export function loc_16bb(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x16bc, 4);
  mem.write8(0x62a0, regs.a);
  m.step(0x16bf, 13);
  regs.a = mem.read8(0x63a3);
  m.step(0x16c2, 13);
  regs.c = regs.a;
  m.step(0x16c3, 4); // ld c,a
  regs.a = mem.read8(0x6910);
  m.step(0x16c6, 13);
  regs.cp(0x5a);
  m.step(0x16c8, 7);
  if (regs.fNC) { m.step(0x16e1, 10); return m.call(0x16e1); } // jp nc,0x16e1
  m.step(0x16cb, 10);
  regs.bit(7, regs.c);
  m.step(0x16cd, 8);
  if (regs.fZ) { m.step(0x16d5, 10); return m.call(0x16d5); } // jp z,0x16d5
  m.step(0x16d0, 10);
  return m.call(0x16d0);
}
