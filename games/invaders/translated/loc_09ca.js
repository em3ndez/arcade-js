// SPDX-License-Identifier: GPL-3.0-only
// loc_09ca  (ROM 0x09ca-0x09d5) -- pick the active player's data pointer from bit0 of 0x2067:
// rrc pushes bit0 into carry; carry set -> HL=0x20f8 and return, else HL=0x20fc and return.
export function loc_09ca(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2067); m.step(0x09cd, 13); // 09ca  lda 0x2067
  regs.rrca(); m.step(0x09ce, 4); // 09cd  rrc (bit0 -> carry)
  regs.hl = 0x20f8; m.step(0x09d1, 10); // 09ce  lxi h,0x20f8
  if (regs.fC) { return m.ret(11); } // 09d1  rc
  m.step(0x09d2, 5); // 09d1  rc (not taken)
  regs.hl = 0x20fc; m.step(0x09d5, 10); // 09d2  lxi h,0x20fc
  return m.ret(10); // 09d5  ret
}
