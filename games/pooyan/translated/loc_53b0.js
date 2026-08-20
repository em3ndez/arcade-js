// SPDX-License-Identifier: GPL-3.0-only

// loc_53b0  (ROM 0x53b0-0x5406) -- one-shot spawn/init of the object record at 0x8c30, gated on
// A!=0 && (0x8d59)==0 && (0x8a5f)==0. Sets the 0x8d59 latch, fills the record (fields from table
// 0x5902 via rst 0x20 and its NEG), calls loc_381e, then derives 0x8d5c/0x8d5d via table 0x5407.
export function loc_53b0(m) {
  const { regs, mem } = m;

  regs.and(regs.a);                                 m.step(0x53b1, 4);
  if (regs.fZ) { return m.ret(11); }                m.step(0x53b2, 5); // ret z -- A==0
  regs.a = mem.read8(0x8d59);                        m.step(0x53b5, 13);
  regs.and(regs.a);                                  m.step(0x53b6, 4);
  if (regs.fNZ) { return m.ret(11); }                m.step(0x53b7, 5); // ret nz -- already spawned
  regs.a = mem.read8(0x8a5f);                         m.step(0x53ba, 13);
  regs.and(regs.a);                                  m.step(0x53bb, 4);
  if (regs.fNZ) { return m.ret(11); }                m.step(0x53bc, 5); // ret nz

  regs.a = regs.inc8(regs.a);                        m.step(0x53bd, 4);
  mem.write8(0x8d59, regs.a);                         m.step(0x53c0, 13); // latch = 1
  regs.ix = 0x8c30;                                  m.step(0x53c4, 14);
  regs.hl = 0x5902;                                  m.step(0x53c7, 10);
  m.push16(0x53c8); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = (table 0x5902)[A]
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a);      m.step(0x53cb, 19);
  regs.neg();                                        m.step(0x53cd, 8);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);      m.step(0x53d0, 19);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);        m.step(0x53d4, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x0b);        m.step(0x53d8, 19);
  regs.xor(regs.a);                                  m.step(0x53d9, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);      m.step(0x53dc, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, 0x04);        m.step(0x53e0, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);      m.step(0x53e3, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a);      m.step(0x53e6, 19);
  regs.cpl();                                        m.step(0x53e7, 4);
  mem.write8(0x8d4b, regs.a);                         m.step(0x53ea, 13);
  regs.de = 0x4203;                                  m.step(0x53ed, 10);
  m.push16(0x53f0); m.step(0x381e, 17); m.call(0x381e);

  regs.a = mem.read8(0x8907);                         m.step(0x53f3, 13);
  regs.a = regs.srl(regs.a);                          m.step(0x53f5, 8);
  regs.a = regs.inc8(regs.a);                         m.step(0x53f6, 4);
  regs.cp(0x07);                                     m.step(0x53f8, 7);
  if (regs.fC) {
    m.step(0x53fc, 12); // jr c taken -- index < 7
  } else {
    m.step(0x53fa, 7);
    regs.a = 0x06;                                   m.step(0x53fc, 7); // clamp
  }
  mem.write8(0x8d5c, regs.a);                         m.step(0x53ff, 13);
  regs.hl = 0x5407;                                  m.step(0x5402, 10);
  m.push16(0x5403); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = (table 0x5407)[A]
  mem.write8(0x8d5d, regs.a);                         m.step(0x5406, 13);
  return m.ret(); // 5406  ret
}
