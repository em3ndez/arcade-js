// SPDX-License-Identifier: GPL-3.0-only
// loc_92ad  (ROM 0x92ad-0x92b1) -- $50 = 0x00, rts.
export function loc_92ad(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x92af, 2);
  mem.write8(0x50, regs.a); m.step(0x92b1, 3);
  return m.ret(6);
}
