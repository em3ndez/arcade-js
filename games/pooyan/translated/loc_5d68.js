// SPDX-License-Identifier: GPL-3.0-only

// loc_5d68  (ROM 0x5d68-0x5dc1) -- proximity test between a source object (IX) and a target
// object (IY); on a hit, re-initialises the record at (HL) and returns TWO frames up.
// Guards: (HL) must be non-0 and non-5. A bounding-box offset (E,D) is picked from 0x881f
// (0xfc/0x00 when set, 0x05/0x10 when clear), added to (IX+0)/(IX+2); |(IY+0)-E| must be < 4
// and |((IY+2)+8)-D| in [9,0x0f). If in range, (HL) is seeded to IX and slot fields 0/1/2/7 and
// the 0x5dc2 handler pointer (+0x12/+0x13) are written, loc_0f2b runs, then `pop af; ret` discards
// this routine's own return address so control resumes at the CALLER's caller.
export function loc_5d68(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);      m.step(0x5d69, 7);
  regs.and(regs.a);                 m.step(0x5d6a, 4);
  if (regs.fZ) { return m.ret(11); }               // ret z -- (HL) == 0
  m.step(0x5d6b, 5);
  regs.cp(0x05);                    m.step(0x5d6d, 7);
  if (regs.fZ) { return m.ret(11); }               // ret z -- (HL) == 5
  m.step(0x5d6e, 5);

  regs.e = 0xfc;                    m.step(0x5d70, 7);
  regs.d = 0x00;                    m.step(0x5d72, 7);
  regs.a = mem.read8(0x881f);       m.step(0x5d75, 13);
  regs.and(regs.a);                 m.step(0x5d76, 4);
  if (regs.fNZ) {
    m.step(0x5d7c, 12);             // jr nz -- keep E=0xfc, D=0x00
  } else {
    m.step(0x5d78, 7);
    regs.e = 0x05;                  m.step(0x5d7a, 7);
    regs.d = 0x10;                  m.step(0x5d7c, 7);
  }

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x5d7f, 19);
  regs.add(regs.e);                 m.step(0x5d80, 4);
  regs.e = regs.a;                  m.step(0x5d81, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x5d84, 19);
  regs.add(regs.d);                 m.step(0x5d85, 4);
  regs.d = regs.a;                  m.step(0x5d86, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x5d89, 19);
  regs.sub(regs.e);                 m.step(0x5d8a, 4);
  if (regs.fNC) {
    m.step(0x5d8e, 12);             // jr nc -- already positive
  } else {
    m.step(0x5d8c, 7);
    regs.neg();                     m.step(0x5d8e, 8);   // |dx|
  }
  regs.cp(0x04);                    m.step(0x5d90, 7);
  if (regs.fNC) { return m.ret(11); }              // ret nc -- |dx| >= 4, no hit
  m.step(0x5d91, 5);

  regs.a = mem.read8((regs.iy + 0x02) & 0xffff); m.step(0x5d94, 19);
  regs.add(0x08);                   m.step(0x5d96, 7);
  regs.sub(regs.d);                 m.step(0x5d97, 4);
  if (regs.fNC) {
    m.step(0x5d9b, 12);             // jr nc
  } else {
    m.step(0x5d99, 7);
    regs.neg();                     m.step(0x5d9b, 8);   // |dy|
  }
  regs.cp(0x09);                    m.step(0x5d9d, 7);
  if (regs.fC) { return m.ret(11); }               // ret c -- |dy| < 9
  m.step(0x5d9e, 5);
  regs.cp(0x0f);                    m.step(0x5da0, 7);
  if (regs.fNC) { return m.ret(11); }              // ret nc -- |dy| >= 0x0f
  m.step(0x5da1, 5);

  // hit: point IX at the record (HL) and re-seed its fields + the 0x5dc2 handler pointer
  m.push16(regs.hl);                m.step(0x5da2, 11);  // push hl
  regs.ix = m.pop16();              m.step(0x5da4, 14);  // pop ix -- IX = HL
  mem.write8((regs.ix + 0x00) & 0xffff, 0x00); m.step(0x5da8, 19);
  mem.write8((regs.ix + 0x01) & 0xffff, 0x01); m.step(0x5dac, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x0c); m.step(0x5db0, 19);
  mem.write8((regs.ix + 0x07) & 0xffff, 0x01); m.step(0x5db4, 19);
  regs.hl = 0x5dc2;                 m.step(0x5db7, 10);
  mem.write8((regs.ix + 0x13) & 0xffff, regs.h); m.step(0x5dba, 19);
  mem.write8((regs.ix + 0x12) & 0xffff, regs.l); m.step(0x5dbd, 19);

  m.push16(0x5dc0);
  m.step(0x0f2b, 17);               // 5dbd  call 0x0f2b
  m.call(0x0f2b);

  regs.af = m.pop16();              m.step(0x5dc1, 10);  // pop af -- discard own return address
  return m.ret(10);                 // ret -- returns to the caller's caller
}
