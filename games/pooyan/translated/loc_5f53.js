// SPDX-License-Identifier: GPL-3.0-only

// loc_5f53  (ROM 0x5f53-0x5f69) -- leaf collision pre-check. E <- (ix+0) + bias (bias 6, or -2
// when 0x881f==0); A <- (ix+2)+8, then `cp 0xe0` returns carry set when that stays below 0xe0.
// No calls. Every m.step target is the ROM address of the next instruction.
export function loc_5f53(m) {
  const { regs, mem } = m;

  regs.e = 0x06;                             m.step(0x5f55, 7);
  regs.a = mem.read8(0x881f);                m.step(0x5f58, 13);
  regs.and(regs.a);                          m.step(0x5f59, 4);
  if (regs.fNZ) {
    m.step(0x5f5d, 12);                      // jr nz,0x5f5d taken -- keep bias 6
  } else {
    m.step(0x5f5b, 7);                       // jr nz not taken
    regs.e = 0xfe;                           m.step(0x5f5d, 7); // bias -2
  }
  regs.a = mem.read8((regs.ix + 0) & 0xffff); m.step(0x5f60, 19);
  regs.add(regs.e);                          m.step(0x5f61, 4);
  regs.e = regs.a;                           m.step(0x5f62, 4);
  regs.a = mem.read8((regs.ix + 2) & 0xffff); m.step(0x5f65, 19);
  regs.add(0x08);                            m.step(0x5f67, 7);
  regs.cp(0xe0);                             m.step(0x5f69, 7);

  return m.ret(10);
}
