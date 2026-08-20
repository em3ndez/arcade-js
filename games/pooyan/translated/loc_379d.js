// SPDX-License-Identifier: GPL-3.0-only

// loc_379d  (ROM 0x379d-0x381d) -- initialise a new IY actor slot from the IX template. Copies
// biased position fields (ix+5/+3 +0x80, ix+4 -1, ix+6 +1), selects a byte table (0x38a5 or
// 0x38ad per 0x8820==7), indexes it by 0x8900 (clamped <8) via rst 0x20, negates that value when
// 0x8907 bit0 is set, computes an anim frame from (ix+7)>>4 via loc_0c45, copies the anim pointer
// (0x3952 when (ix+0x0b)!=0), then tail-jp 0x0ee3 to link the slot in.
export function loc_379d(m) {
  const { regs, mem } = m;

  mem.write8((regs.iy + 0x00) & 0xffff, 0x01);    m.step(0x37a1, 19);
  mem.write8((regs.iy + 0x02) & 0xffff, 0x04);    m.step(0x37a5, 19);
  mem.write8((regs.iy + 0x14) & 0xffff, regs.c);  m.step(0x37a8, 19);
  regs.xor(regs.a);                               m.step(0x37a9, 4);
  mem.write8((regs.iy + 0x07) & 0xffff, regs.a);  m.step(0x37ac, 19);
  mem.write8((regs.iy + 0x0e) & 0xffff, regs.a);  m.step(0x37af, 19);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);  m.step(0x37b2, 19);
  regs.add(0x80);                                 m.step(0x37b4, 7);
  mem.write8((regs.iy + 0x05) & 0xffff, regs.a);  m.step(0x37b7, 19);
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff);  m.step(0x37ba, 19);
  regs.add(0x80);                                 m.step(0x37bc, 7);
  mem.write8((regs.iy + 0x03) & 0xffff, regs.a);  m.step(0x37bf, 19);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);  m.step(0x37c2, 19);
  regs.sub(0x01);                                 m.step(0x37c4, 7);
  mem.write8((regs.iy + 0x04) & 0xffff, regs.a);  m.step(0x37c7, 19);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);  m.step(0x37ca, 19);
  regs.add(0x01);                                 m.step(0x37cc, 7);
  mem.write8((regs.iy + 0x06) & 0xffff, regs.a);  m.step(0x37cf, 19);

  regs.hl = 0x38a5;                m.step(0x37d2, 10);
  regs.a = mem.read8(0x8820);      m.step(0x37d5, 13);
  regs.cp(0x07);                   m.step(0x37d7, 7);
  if (regs.fNZ) {
    m.step(0x37dc, 12);            // jr nz taken
  } else {
    m.step(0x37d9, 7);
    regs.hl = 0x38ad;              m.step(0x37dc, 10);
  }
  regs.a = mem.read8(0x8900);      m.step(0x37df, 13);
  regs.cp(0x08);                   m.step(0x37e1, 7);
  if (regs.fC) {
    m.step(0x37e5, 12);            // jr c taken -- 0x8900 < 8
  } else {
    m.step(0x37e3, 7);
    regs.a = 0x07;                 m.step(0x37e5, 7);
  }
  m.push16(0x37e6); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = table[HL+A]

  regs.a = mem.read8(0x8907);      m.step(0x37e9, 13);
  regs.and(0x01);                  m.step(0x37eb, 7);
  regs.a = mem.read8(regs.hl);     m.step(0x37ec, 7); // A = table byte; flags from the and above
  if (regs.fZ) {
    m.step(0x37f0, 12);            // jr z taken -- bit0 clear, keep A
  } else {
    m.step(0x37ee, 7);
    regs.neg();                    m.step(0x37f0, 8);
  }
  mem.write8((regs.iy + 0x0a) & 0xffff, regs.a);  m.step(0x37f3, 19);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);  m.step(0x37f6, 19);
  regs.hl = 0x38b5;                m.step(0x37f9, 10);
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff);  m.step(0x37fc, 19);
  regs.and(0xf0);                  m.step(0x37fe, 7);
  regs.rrca();                     m.step(0x37ff, 4);
  regs.rrca();                     m.step(0x3800, 4);
  regs.rrca();                     m.step(0x3801, 4);
  regs.rrca();                     m.step(0x3802, 4);
  m.push16(0x3805); m.step(0x0c45, 17); m.call(0x0c45);

  regs.a = mem.read8((regs.ix + 0x0b) & 0xffff);  m.step(0x3808, 19);
  regs.and(regs.a);                m.step(0x3809, 4);
  if (regs.fZ) {
    m.step(0x380e, 12);            // jr z taken -- (ix+0x0b)==0, keep DE
  } else {
    m.step(0x380b, 7);
    regs.de = 0x3952;             m.step(0x380e, 10);
  }
  mem.write8((regs.iy + 0x0b) & 0xffff, regs.a);  m.step(0x3811, 19);
  mem.write8((regs.iy + 0x0c) & 0xffff, regs.e);  m.step(0x3814, 19);
  mem.write8((regs.iy + 0x0d) & 0xffff, regs.d);  m.step(0x3817, 19);
  mem.write8((regs.iy + 0x11) & 0xffff, 0x28);    m.step(0x381b, 19);
  m.step(0x0ee3, 10);              // jp 0x0ee3 (tail)
  return m.call(0x0ee3);
}
