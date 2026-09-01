// SPDX-License-Identifier: GPL-3.0-only
// loc_00b1  (ROM 0x00b1-0x00d6) -- fetch a 16-bit pointer via helper 0x0886, mirror to
// 0x2009/0x200b, derive 0x2008 (byte below ptr, dec'd when 0x03) and the 0x200d flag (set when byte==0xfe).
export function loc_00b1(m) {
  const { regs, mem } = m;

  m.push16(0x00b4); m.step(0x0886, 17); m.call(0x0886); // 00b1  call 0x0886
  m.push16(regs.hl); m.step(0x00b5, 11); // 00b4  push h
  regs.a = mem.read8(regs.hl); m.step(0x00b6, 7); // 00b5  mov a,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x00b7, 5); // 00b6  inx h
  regs.h = mem.read8(regs.hl); m.step(0x00b8, 7); // 00b7  mov h,m
  regs.l = regs.a; m.step(0x00b9, 5); // 00b8  mov l,a
  mem.write16(0x2009, regs.hl); m.step(0x00bc, 16); // 00b9  shld 0x2009
  mem.write16(0x200b, regs.hl); m.step(0x00bf, 16); // 00bc  shld 0x200b
  regs.hl = m.pop16(); m.step(0x00c0, 10); // 00bf  pop h
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x00c1, 5); // 00c0  dcx h
  regs.a = mem.read8(regs.hl); m.step(0x00c2, 7); // 00c1  mov a,m
  regs.cp(0x03); m.step(0x00c4, 7); // 00c2  cpi 0x03
  if (regs.fNZ) {
    m.step(0x00c8, 10);
  } else {
    m.step(0x00c7, 10);
    regs.a = regs.dec8(regs.a); m.step(0x00c8, 5); // 00c7  dcr a
  }
  mem.write8(0x2008, regs.a); m.step(0x00cb, 13); // 00c8  sta 0x2008
  regs.cp(0xfe); m.step(0x00cd, 7); // 00cb  cpi 0xfe
  regs.a = 0x00; m.step(0x00cf, 7); // 00cd  mvi a,0x00
  if (regs.fNZ) {
    m.step(0x00d3, 10);
  } else {
    m.step(0x00d2, 10);
    regs.a = regs.inc8(regs.a); m.step(0x00d3, 5); // 00d2  inr a
  }
  mem.write8(0x200d, regs.a); m.step(0x00d6, 13); // 00d3  sta 0x200d
  return m.ret(10); // 00d6  ret
}
