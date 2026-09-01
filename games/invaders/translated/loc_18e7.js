// SPDX-License-Identifier: GPL-3.0-only
// loc_18e7  (ROM 0x18e7-0x18f0) -- reads 0x2067, seats HL=0x20e7, and bumps HL to 0x20e8
// only when bit0 of the byte was set (rrc -> carry; rnc returns early otherwise).
export function loc_18e7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2067); m.step(0x18ea, 13); // 18e7  lda 0x2067
  regs.hl = 0x20e7; m.step(0x18ed, 10); // 18ea  lxi h,0x20e7
  regs.rrca(); m.step(0x18ee, 4); // 18ed  rrc
  if (regs.fNC) { return m.ret(11); } // 18ee  rnc (taken)
  m.step(0x18ef, 5); // 18ee  rnc (not taken)
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x18f0, 5); // 18ef  inx h
  return m.ret(10); // 18f0  ret
}
