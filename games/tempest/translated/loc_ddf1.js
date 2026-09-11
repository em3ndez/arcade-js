// SPDX-License-Identifier: GPL-3.0-only
// loc_ddf1  (ROM 0xddf1-0xde10) -- entry ddf1: A=7,Y=0xff (BNE always taken via Y=0xff -> ddff); the
// ddf7/ddfb alt-entries pick A=3/4,Y=0. Stores Y->$01c6, then $01c7 |= A and $01c8 |= A, returns.
export function loc_ddf1(m) {
  const { regs, mem } = m;
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0xddf3, 2);
  regs.y = 0xff; regs.setNZ(regs.y); m.step(0xddf5, 2);
  if (regs.fNZ) {
    m.step(0xddff, 3);
  } else {
    m.step(0xddf7, 2);
    regs.a = 0x03; regs.setNZ(regs.a); m.step(0xddf9, 2);
    if (regs.fNZ) {
      m.step(0xddfd, 3);
    } else {
      m.step(0xddfb, 2);
      regs.a = 0x04; regs.setNZ(regs.a); m.step(0xddfd, 2);
    }
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xddff, 2);
  }
  mem.write8(0x01c6, regs.y); m.step(0xde02, 4);
  m.push8(regs.a); m.step(0xde03, 3);
  regs.ora(mem.read8(0x01c7)); m.step(0xde06, 4);
  mem.write8(0x01c7, regs.a); m.step(0xde09, 4);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xde0a, 4);
  regs.ora(mem.read8(0x01c8)); m.step(0xde0d, 4);
  mem.write8(0x01c8, regs.a); m.step(0xde10, 4);
  return m.ret(6);
}
