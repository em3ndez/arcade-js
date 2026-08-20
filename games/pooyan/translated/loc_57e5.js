// SPDX-License-Identifier: GPL-3.0-only

// loc_57e5  (ROM 0x57e5-0x57ef) -- leaf: A <- (BC), dec the counter at (HL), then stamp two
// object bytes -- (ix+0x13)=0x01 and (ix+0x16)=0xc1 -- and ret. No calls.
export function loc_57e5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.bc);                       m.step(0x57e6, 7);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); m.step(0x57e7, 11);
  mem.write8((regs.ix + 0x13) & 0xffff, 0x01);       m.step(0x57eb, 19);
  mem.write8((regs.ix + 0x16) & 0xffff, 0xc1);       m.step(0x57ef, 19);
  return m.ret(10);
}
