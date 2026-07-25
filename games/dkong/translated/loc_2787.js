// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2787  (ROM 0x2787–0x2796) — move up: (0x6205)>=0xE8 -> reset277f; else inc (0x6205), mirror to 0x694F.
 */
export function loc_2787(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6205);
  m.step(0x278a, 13);
  regs.cp(0xe8);
  m.step(0x278c, 7);
  if (regs.fNC) { m.step(0x277f, 10); return m.call(0x277f); }
  m.step(0x278f, 10);
  regs.a = regs.inc8(regs.a);
  m.step(0x2790, 4);
  mem.write8(0x6205, regs.a);
  m.step(0x2793, 13);
  mem.write8(0x694f, regs.a);
  m.step(0x2796, 13);
  m.ret(10);
}
