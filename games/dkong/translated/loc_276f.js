// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_276f  (ROM 0x276F–0x277E) — move down: (0x6205)<0x71 -> reset277f; else dec (0x6205), mirror to 0x694F.
 */
export function loc_276f(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6205);
  m.step(0x2772, 13);
  regs.cp(0x71);
  m.step(0x2774, 7);
  if (regs.fC) { m.step(0x277f, 10); return m.call(0x277f); }
  m.step(0x2777, 10);
  regs.a = regs.dec8(regs.a);
  m.step(0x2778, 4);
  mem.write8(0x6205, regs.a);
  m.step(0x277b, 13);
  mem.write8(0x694f, regs.a);
  m.step(0x277e, 13);
  m.ret(10);
}
