// SPDX-License-Identifier: GPL-3.0-only
// loc_a83a  (ROM 0xa83a-0xa882) -- attract/timer step on $05 sign: advances $0125 vs table $a883,x
// (calls loc_a888), or updates $03aa/$4e; every path clears bit7 of $4e before rts.
export function loc_a83a(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xa83c, 3);
  if (regs.fPl) {
    m.step(0xa87c, 3);
  } else {
    m.step(0xa83e, 2);
    regs.a = mem.read8(0x0125); regs.setNZ(regs.a); m.step(0xa841, 4);
    if (regs.fNZ) {
      m.step(0xa866, 3);
      mem.write8(0x0125, regs.inc8(mem.read8(0x0125))); m.step(0xa869, 6);// a866 inc 0x0125
      regs.x = mem.read8(0x03aa); regs.setNZ(regs.x); m.step(0xa86c, 4);
      regs.a = mem.read8(0x0125); regs.setNZ(regs.a); m.step(0xa86f, 4);
      regs.cmp(mem.read8((0xa883 + regs.x) & 0xffff)); m.step(0xa872, 4);
      if (regs.fNC) {
        m.step(0xa879, 3);
      } else {
        m.step(0xa874, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa876, 2);
        mem.write8(0x0125, regs.a); m.step(0xa879, 4);
      }
      m.push16(0xa87b); m.step(0xa87c, 6); m.call(0xa888);
    } else {
      m.step(0xa843, 2);
      regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xa846, 4);
      if (regs.fN) {
        m.step(0xa863, 3);
      } else {
        m.step(0xa848, 2);
        regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0xa84a, 3);
        regs.and(0x08); m.step(0xa84c, 2);
        if (regs.fZ) {
          m.step(0xa863, 3);
        } else {
          m.step(0xa84e, 2);
          regs.a = mem.read8(0x03aa); regs.setNZ(regs.a); m.step(0xa851, 4);
          regs.cmp(0x02); m.step(0xa853, 2);
          if (regs.fC) {
            m.step(0xa85d, 3);
          } else {
            m.step(0xa855, 2);
            mem.write8(0x03aa, regs.inc8(mem.read8(0x03aa))); m.step(0xa858, 6);
            regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa85a, 2);
            mem.write8(0x0125, regs.a); m.step(0xa85d, 4);
          }
          regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0xa85f, 3);
          regs.and(0x77); m.step(0xa861, 2);
          mem.write8(0x4e, regs.a); m.step(0xa863, 3);
        }
      }
      regs.clv(); m.step(0xa864, 2);
      m.step(0xa87c, 3);
    }
  }
  regs.a = mem.read8(0x4e); regs.setNZ(regs.a); m.step(0xa87e, 3);
  regs.and(0x7f); m.step(0xa880, 2);
  mem.write8(0x4e, regs.a); m.step(0xa882, 3);
  return m.ret(6);
}
