// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2299  (ROM 0x2299–0x22A1) — sub_2207-body arm: every-4th-frame (0x6018&0x3C==0) advance state at record base.
 */
export function loc_2299(m) {
  const { regs, mem } = m;
  regs.hl = m.pop16();
  m.step(0x229a, 10);
  regs.a = mem.read8(0x6018);
  m.step(0x229d, 13);
  regs.and(0x3c);
  m.step(0x229f, 7);
  if (regs.fNZ) { m.ret(5); return; }
  m.step(0x22a0, 11);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x22a1, 11); // advance state
  m.ret(10);
}
