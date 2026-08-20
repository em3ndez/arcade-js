// SPDX-License-Identifier: GPL-3.0-only

// loc_6287  (ROM 0x6287-0x62e5) -- proximity test between actor IX and target IY. E-bias is 6 or
// -2 per (0x881f); if |(iy+0)-(ix+0)-bias| >= 6 or |(iy+2)-(ix+2)| >= 7 the actors miss -> jp 0x60f2.
// Passing kind C (=A on entry) == 0x50 -> jp 0x60d9. On a hit: latch IX = HL, advance the anim frame
// at (ix+0x0a) by table 0x6360[(0x8907&7)>>1] (rst 0x20), reload IY, then fall through into loc_62e6.
export function loc_6287(m) {
  const { regs, mem } = m;

  regs.c = regs.a;                                m.step(0x6288, 4);
  regs.e = 0x06;                                  m.step(0x628a, 7);
  regs.a = mem.read8(0x881f);                     m.step(0x628d, 13);
  regs.and(regs.a);                               m.step(0x628e, 4);
  if (regs.fNZ) {
    m.step(0x6292, 12);                           // jr nz -- keep E = 6
  } else {
    m.step(0x6290, 7);
    regs.e = 0xfe;                                m.step(0x6292, 7); // E = -2
  }
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);  m.step(0x6295, 19);
  regs.add(regs.e);                               m.step(0x6296, 4);
  regs.e = regs.a;                                m.step(0x6297, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);  m.step(0x629a, 19);
  regs.add(0x08);                                 m.step(0x629c, 7);
  regs.d = regs.a;                                m.step(0x629d, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);  m.step(0x62a0, 19);
  regs.sub(regs.e);                               m.step(0x62a1, 4);
  if (regs.fC) {
    m.step(0x62a3, 7);
    regs.neg();                                   m.step(0x62a5, 8);
  } else {
    m.step(0x62a5, 12);                           // jr nc -- |dx| already >= 0
  }
  regs.cp(0x06);                                  m.step(0x62a7, 7);
  if (regs.fNC) { m.step(0x60f2, 10); return m.call(0x60f2); } // jp nc -- out of X range
  m.step(0x62aa, 10);
  regs.a = mem.read8((regs.iy + 0x02) & 0xffff);  m.step(0x62ad, 19);
  regs.add(0x08);                                 m.step(0x62af, 7);
  regs.sub(regs.d);                               m.step(0x62b0, 4);
  if (regs.fC) {
    m.step(0x62b2, 7);
    regs.neg();                                   m.step(0x62b4, 8);
  } else {
    m.step(0x62b4, 12);                           // jr nc
  }
  regs.cp(0x07);                                  m.step(0x62b6, 7);
  if (regs.fNC) { m.step(0x60f2, 10); return m.call(0x60f2); } // jp nc -- out of Y range
  m.step(0x62b9, 10);
  regs.a = regs.c;                                m.step(0x62ba, 4);
  regs.cp(0x50);                                  m.step(0x62bc, 7);
  if (regs.fZ) { m.step(0x60d9, 10); return m.call(0x60d9); } // jp z -- kind 0x50
  m.step(0x62bf, 10);
  m.push16(regs.hl);                              m.step(0x62c0, 11);
  regs.ix = m.pop16();                            m.step(0x62c2, 14); // ix = hl
  regs.de = 0x6349;                               m.step(0x62c5, 10);
  m.push16(0x62c8); m.step(0x381e, 17); m.call(0x381e);
  regs.hl = 0x6360;                               m.step(0x62cb, 10);
  regs.a = mem.read8(0x8907);                     m.step(0x62ce, 13);
  regs.and(0x07);                                 m.step(0x62d0, 7);
  regs.rra();                                     m.step(0x62d1, 4);
  m.push16(0x62d2); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- frame-table lookup
  regs.l = regs.a;                                m.step(0x62d3, 4);
  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);  m.step(0x62d6, 19);
  regs.add(regs.l);                               m.step(0x62d7, 4);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);  m.step(0x62da, 19);
  regs.iy = 0x8ae0;                               m.step(0x62de, 14);
  regs.a = mem.read8((regs.ix + 0x14) & 0xffff);  m.step(0x62e1, 19);
  regs.c = 0x06;                                  m.step(0x62e3, 7);
  regs.de = 0x0018;                               m.step(0x62e6, 10);
  return m.call(0x62e6); // fall through into loc_62e6 (actor search -> jp 0x6274)
}
