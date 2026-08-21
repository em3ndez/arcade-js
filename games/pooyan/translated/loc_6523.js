// SPDX-License-Identifier: GPL-3.0-only

// loc_6523  (ROM 0x6523-0x6565) -- object-record init: bail if (ix+0)|(ix+1) is odd (rrca->C) or the
// 0x8ef0 gate is set; else seat the IX record ((ix+0)=1, +3/+5=0, +4=0x15, +6=(0x8929), +0f=3, +10=0xc0,
// +8=0x30, +9=0xf0), decrement the 0x8929 pool by 2, and emit display words via rst 0x38 (de=0x0611;
// then, when 0x8907 is clear, e=7).
export function loc_6523(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0) & 0xffff);   m.step(0x6526, 19);
  regs.or(mem.read8((regs.ix + 1) & 0xffff));   m.step(0x6529, 19);
  regs.rrca();                                  m.step(0x652a, 4);
  if (regs.fC) { m.ret(11); return; }           // 652a  ret c -- low bit set
  m.step(0x652b, 5);
  regs.a = mem.read8(0x8ef0);                    m.step(0x652e, 13);
  regs.and(regs.a);                             m.step(0x652f, 4);
  if (regs.fNZ) { m.ret(11); return; }          // 652f  ret nz -- gate held
  m.step(0x6530, 5);

  mem.write8((regs.ix + 0) & 0xffff, 0x01);     m.step(0x6534, 19);
  mem.write8((regs.ix + 3) & 0xffff, regs.a);   m.step(0x6537, 19);
  mem.write8((regs.ix + 5) & 0xffff, regs.a);   m.step(0x653a, 19);
  mem.write8((regs.ix + 4) & 0xffff, 0x15);     m.step(0x653e, 19);
  regs.a = mem.read8(0x8929);                    m.step(0x6541, 13);
  mem.write8((regs.ix + 6) & 0xffff, regs.a);   m.step(0x6544, 19);
  regs.sub(0x02);                               m.step(0x6546, 7);
  mem.write8(0x8929, regs.a);                    m.step(0x6549, 13);
  mem.write8((regs.ix + 0x0f) & 0xffff, 0x03);  m.step(0x654d, 19);
  mem.write8((regs.ix + 0x10) & 0xffff, 0xc0);  m.step(0x6551, 19);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x30);  m.step(0x6555, 19);
  mem.write8((regs.ix + 0x09) & 0xffff, 0xf0);  m.step(0x6559, 19);
  regs.de = 0x0611;                             m.step(0x655c, 10);
  m.push16(0x655d); m.step(0x0038, 11); m.call(0x0038); // 655c  rst 0x38

  regs.a = mem.read8(0x8907);                    m.step(0x6560, 13);
  regs.and(regs.a);                             m.step(0x6561, 4);
  if (regs.fNZ) { m.ret(11); return; }          // 6561  ret nz
  m.step(0x6562, 5);
  regs.e = 0x07;                                m.step(0x6564, 7);
  m.push16(0x6565); m.step(0x0038, 11); m.call(0x0038); // 6564  rst 0x38
  return m.ret(10);
}
