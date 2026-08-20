// SPDX-License-Identifier: GPL-3.0-only

// loc_13bc  (ROM 0x13bc-0x13fd) -- scan the five 0x18-byte slots at 0x8b70 for a free one
// ((iy+0)|(iy+1) has bit0 clear). If none is free, ret. Otherwise bump the wrapping counter at
// 0x8d41 (skip 0), stamp it into (ix+0x14), point the found slot's IX record at anim 0x3988,
// clear (ix+0x0e), set (ix+0x11)=0x28 / (ix+0x02)=0x04, then tail-jp 0x142c.
export function loc_13bc(m) {
  const { regs, mem } = m;

  regs.iy = 0x8b70;                m.step(0x13c0, 14);
  regs.de = 0x0018;                m.step(0x13c3, 10);
  regs.b = 0x05;                   m.step(0x13c5, 7);

  for (;;) { // 0x13c5
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff);  m.step(0x13c8, 19);
    regs.or(mem.read8((regs.iy + 0x01) & 0xffff));  m.step(0x13cb, 19);
    regs.rrca();                                    m.step(0x13cc, 4); // carry = bit0
    if (regs.fNC) { m.step(0x13db, 12); break; }    // slot free -> init
    m.step(0x13ce, 7);
    regs.addIy(regs.de);           m.step(0x13d0, 15);
    if (regs.djnz() !== 0) { m.step(0x13c5, 13); continue; }
    m.step(0x13d2, 8);
    return m.ret(10); // no free slot
  }

  // 0x13db: initialise the found slot's owning IX record
  regs.hl = 0x8d41;                m.step(0x13de, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));  m.step(0x13df, 11);
  if (regs.fNZ) {
    m.step(0x13e2, 12);            // non-zero -> keep it
  } else {
    m.step(0x13e1, 7);
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); m.step(0x13e2, 11); // skip 0
  }
  regs.c = mem.read8(regs.hl);     m.step(0x13e3, 7);
  mem.write8((regs.ix + 0x14) & 0xffff, regs.c);  m.step(0x13e6, 19);
  regs.hl = 0x3988;                m.step(0x13e9, 10);
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.l);  m.step(0x13ec, 19);
  mem.write8((regs.ix + 0x0d) & 0xffff, regs.h);  m.step(0x13ef, 19);
  mem.write8((regs.ix + 0x0e) & 0xffff, 0x00);    m.step(0x13f3, 19);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x28);    m.step(0x13f7, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x04);    m.step(0x13fb, 19);
  m.step(0x142c, 10);              // jp 0x142c (tail)
  return m.call(0x142c);
}
