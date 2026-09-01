// SPDX-License-Identifier: GPL-3.0-only
// loc_1910  (ROM 0x1910-0x1919) -- seats HL=0x20e7, reads 0x2067, and bumps HL to 0x20e8 only
// when bit0 of the byte was CLEAR (rrc -> carry set returns early via rc). Mirror of loc_18e7.
export function loc_1910(m) {
  const { regs, mem } = m;

  regs.hl = 0x20e7; m.step(0x1913, 10); // 1910  lxi h,0x20e7
  regs.a = mem.read8(0x2067); m.step(0x1916, 13); // 1913  lda 0x2067
  regs.rrca(); m.step(0x1917, 4); // 1916  rrc
  if (regs.fC) { return m.ret(11); } // 1917  rc (taken)
  m.step(0x1918, 5); // 1917  rc (not taken)
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1919, 5); // 1918  inx h
  return m.ret(10); // 1919  ret
}
