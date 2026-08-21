// SPDX-License-Identifier: GPL-3.0-only

// loc_6a0f  (ROM 0x6a0f-0x6a34) -- gated by three (0x892b) block bytes: rets if (0x892b)==0 or
// (0x892c)==0x06; else if (0x892a)!=0 just decrements it and rets. When (0x892a) hits 0 it runs the
// 18-record sweep (ix from 0x8ae0, stride 0x18) through loc_6a35. exx guards the loop B/DE past the call.
export function loc_6a0f(m) {
  const { regs, mem } = m;

  regs.hl = 0x892b;            m.step(0x6a12, 10);
  regs.a = mem.read8(regs.hl); m.step(0x6a13, 7);
  regs.and(regs.a);           m.step(0x6a14, 4);
  if (regs.fZ) { return m.ret(11); }        // 6a14  ret z
  m.step(0x6a15, 5);

  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x6a16, 6); // inc hl -> 0x892c
  regs.a = mem.read8(regs.hl); m.step(0x6a17, 7);
  regs.cp(0x06);              m.step(0x6a19, 7);
  if (regs.fZ) { return m.ret(11); }        // 6a19  ret z
  m.step(0x6a1a, 5);

  regs.l = 0x2a;             m.step(0x6a1c, 7); // ld l -> 0x892a (h kept)
  regs.a = mem.read8(regs.hl); m.step(0x6a1d, 7);
  regs.and(regs.a);           m.step(0x6a1e, 4);
  if (regs.fNZ) {
    m.step(0x6a20, 7);        // jr z not taken
    regs.decMem8(mem, regs.hl); m.step(0x6a21, 11); // dec (0x892a)
    return m.ret(10);         // 6a21  ret
  }
  m.step(0x6a22, 12);         // jr z taken

  regs.ix = 0x8ae0;           m.step(0x6a26, 14);
  regs.de = 0x0018;          m.step(0x6a29, 10);
  regs.b = 0x12;            m.step(0x6a2b, 7);
  for (;;) {
    regs.exx();               m.step(0x6a2c, 4);
    m.push16(0x6a2f); m.step(0x6a35, 17); m.call(0x6a35);
    regs.exx();               m.step(0x6a30, 4);
    regs.addIx(regs.de);      m.step(0x6a32, 15);
    if (regs.djnz() !== 0) { m.step(0x6a2b, 13); continue; }
    m.step(0x6a34, 8);
    break;
  }
  return m.ret(10);           // 6a34  ret
}
