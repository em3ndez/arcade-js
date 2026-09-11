// SPDX-License-Identifier: GPL-3.0-only
// loc_9009  (ROM 0x9009-0x9024) -- four subroutine calls, then seeds $5b=0xfa and clears $0106/$5f/$01.
export function loc_9009(m) {
  const { regs, mem } = m;
  m.push16(0x900b); m.step(0x900c, 6); m.call(0x92c5);
  m.push16(0x900e); m.step(0x900f, 6); m.call(0x9234);
  m.push16(0x9011); m.step(0x9012, 6); m.call(0x902b);
  m.push16(0x9014); m.step(0x9015, 6); m.call(0xa831);
  regs.a = 0xfa; regs.setNZ(regs.a); m.step(0x9017, 2);
  mem.write8(0x5b, regs.a); m.step(0x9019, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x901b, 2);
  mem.write8(0x0106, regs.a); m.step(0x901e, 4);
  mem.write8(0x5f, regs.a); m.step(0x9020, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9022, 2);
  mem.write8(0x01, regs.a); m.step(0x9024, 3);
  return m.ret(6);
}
