// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_16e1  (ROM 0x16E1–0x16EB) — (0x6910) >= 0x5A: vs 0x5D + bit7(C) -> loc_16d0/16d5, else reinit + advance 0x6388.
 */
export function loc_16e1(m) {
  const { regs, mem } = m;
  regs.cp(0x5d);
  m.step(0x16e3, 7);
  if (regs.fC) { m.step(0x16ee, 10); return m.call(0x16ee); } // jp c,0x16ee
  m.step(0x16e6, 10);
  regs.bit(7, regs.c);
  m.step(0x16e8, 8);
  if (regs.fZ) { m.step(0x16d0, 10); return m.call(0x16d0); } // jp z,0x16d0
  m.step(0x16eb, 10);
  m.step(0x16d5, 10); // jp 0x16d5
  return m.call(0x16d5);
}
