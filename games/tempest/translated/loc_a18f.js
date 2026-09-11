// SPDX-License-Identifier: GPL-3.0-only
// loc_a18f  (ROM 0xa18f-0xa1e3) -- loop over slots [0x37]=0x0b..0 over $02d3,x: for active slots,
// X<8 advances $02d3,x (adc #9, maybe sbc #4 by $02f2,x) then jsr a1fa and clears at >=0xf0;
// X>=8 adds velocity $0120/$0118 into $02e6,x/$02d3,x and clears past $0202 (dec $a6, jsr a1e4).
export function loc_a18f(m) {
  const { regs, mem } = m;
  regs.x = 0x0b; regs.setNZ(regs.x); m.step(0xa191, 2);
  mem.write8(0x37, regs.x); m.step(0xa193, 3);
  do {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xa195, 3);
    regs.a = mem.read8((0x02d3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa198, 4);
    if (regs.fZ) {
      m.step(0xa1df, 3);
    } else {
      m.step(0xa19a, 2);
      regs.cpx(0x08); m.step(0xa19c, 2);
      if (regs.fC) {
        m.step(0xa1c0, 3);
        regs.a = mem.read8((0x02e6 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa1c3, 4);
        regs.clc(); m.step(0xa1c4, 2);
        regs.adc(mem.read8(0x0120)); m.step(0xa1c7, 4);
        mem.write8((0x02e6 + regs.x) & 0xffff, regs.a); m.step(0xa1ca, 5);
        regs.a = mem.read8((0x02d3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa1cd, 4);
        regs.adc(mem.read8(0x0118)); m.step(0xa1d0, 4);
        regs.cmp(mem.read8(0x0202)); m.step(0xa1d3, 4);
        if (regs.fC) {
          m.step(0xa1dc, 3);
        } else {
          m.step(0xa1d5, 2);
          mem.write8(0xa6, regs.dec8(mem.read8(0xa6))); m.step(0xa1d7, 5);
          m.push16(0xa1d9); m.step(0xa1da, 6); m.call(0xa1e4);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa1dc, 2);
        }
        mem.write8((0x02d3 + regs.x) & 0xffff, regs.a); m.step(0xa1df, 5);
      } else {
        m.step(0xa19e, 2);
        regs.adc(0x09); m.step(0xa1a0, 2);
        regs.y = mem.read8((0x02f2 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xa1a3, 4);
        if (regs.fZ) {
          m.step(0xa1a8, 3);
        } else {
          m.step(0xa1a5, 2);
          regs.sec(); m.step(0xa1a6, 2);
          regs.sbc(0x04); m.step(0xa1a8, 2);
        }
        mem.write8((0x02d3 + regs.x) & 0xffff, regs.a); m.step(0xa1ab, 5);
        m.push16(0xa1ad); m.step(0xa1ae, 6); m.call(0xa1fa);
        regs.a = mem.read8((0x02d3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa1b1, 4);
        regs.cmp(0xf0); m.step(0xa1b3, 2);
        if (regs.fNC) {
          m.step(0xa1bd, 3);
        } else {
          m.step(0xa1b5, 2);
          mem.write8(0x0135, regs.dec8(mem.read8(0x0135))); m.step(0xa1b8, 6);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa1ba, 2);
          mem.write8((0x02d3 + regs.x) & 0xffff, regs.a); m.step(0xa1bd, 5);
        }
        regs.clv(); m.step(0xa1be, 2);
        m.step(0xa1df, 3);
      }
    }
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xa1e1, 5);
    if (regs.fN) { m.step(0xa1e3, 2); break; }
    m.step(0xa193, 3);
  } while (true);
  return m.ret(6);
}
