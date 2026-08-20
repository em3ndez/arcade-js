// SPDX-License-Identifier: GPL-3.0-only

// loc_119a  (ROM 0x119a-0x11f8) -- initialise a spawned actor's IX record. Returns early (ret c) if the
// record's 16-bit id (ix+0/ix+1) is already odd/active. Otherwise seeds state bytes, queues an animation
// (loc_381e), and derives a facing byte + its negation and an attribute byte from (0x8907) via two rst-0x20
// table lookups (tables 0x1209 / 0x11f9). Ends with `pop af; ret`: it discards its OWN caller's return and
// returns one level higher (skip-return) -- the pop must be modelled or the stack desyncs.
export function loc_119a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x119d, 19);
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x11a0, 19);
  regs.rrca();                                   m.step(0x11a1, 4);
  if (regs.fC) { m.ret(11); return; } // 11a1  ret c -- already active
  m.step(0x11a2, 5);

  regs.b = regs.c;                               m.step(0x11a3, 4);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);   m.step(0x11a7, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x03);   m.step(0x11ab, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.e); m.step(0x11ae, 19);
  regs.xor(regs.a);                              m.step(0x11af, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x11b2, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x11b5, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x11b8, 19);
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a); m.step(0x11bb, 19);
  mem.write8((regs.ix + 0x07) & 0xffff, 0x01);   m.step(0x11bf, 19);
  mem.write8((regs.ix + 0x0b) & 0xffff, regs.a); m.step(0x11c2, 19);

  regs.hl = 0x1209;                              m.step(0x11c5, 10);
  regs.a = mem.read8(0x8907);                    m.step(0x11c8, 13);
  regs.and(0x3f);                                m.step(0x11ca, 7);
  regs.a = regs.srl(regs.a);                     m.step(0x11cc, 8);
  regs.a = regs.srl(regs.a);                     m.step(0x11ce, 8);
  regs.cp(0x10);                                 m.step(0x11d0, 7);
  m.push16(0x11d1); m.step(0x0020, 11); m.call(0x0020); // 11d0  rst 0x20 -- A = table[HL+A]

  mem.write8((regs.ix + 0x09) & 0xffff, regs.a); m.step(0x11d4, 19);
  regs.neg();                                    m.step(0x11d6, 8);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a); m.step(0x11d9, 19);
  regs.de = 0x3829;                              m.step(0x11dc, 10);
  m.push16(0x11df); m.step(0x381e, 17); m.call(0x381e); // 11dc  call 0x381e -- queue animation

  regs.hl = 0x11f9;                              m.step(0x11e2, 10);
  regs.a = mem.read8(0x8907);                    m.step(0x11e5, 13);
  regs.and(0x3f);                                m.step(0x11e7, 7);
  regs.a = regs.sra(regs.a);                     m.step(0x11e9, 8);
  regs.a = regs.sra(regs.a);                     m.step(0x11eb, 8);
  m.push16(0x11ec); m.step(0x0020, 11); m.call(0x0020); // 11eb  rst 0x20 -- A = table[HL+A]

  mem.write8(0x8d07, regs.a);                    m.step(0x11ef, 13);
  regs.hl = 0x8f5f;                              m.step(0x11f2, 10);
  regs.incMem8(mem, regs.hl);                    m.step(0x11f3, 11);
  regs.hl = 0x8d40;                              m.step(0x11f6, 10);
  regs.incMem8(mem, regs.hl);                    m.step(0x11f7, 11);
  regs.af = m.pop16();                           m.step(0x11f8, 10); // 11f7  pop af -- drop caller's return
  m.ret(); // 11f8  ret -- returns to the caller's CALLER (skip-return)
}
