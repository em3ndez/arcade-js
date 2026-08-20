// SPDX-License-Identifier: GPL-3.0-only

// loc_5489  (ROM 0x5489-0x54c4) -- initialise an actor block at IX. Seeds fields (ix+0)=1, (ix+2)=
// (ix+5)=0, (ix+3)=0x60, (ix+4)=0x1b, (ix+6)=B, then looks up its animation word (0x5657 via loc_0c45)
// and installs it (loc_381e), sets (ix+0x11)=0x40, and picks a signed speed for (ix+0x0a): index C
// into 0x55d7 then index 3*(0x8907&7) into that table (both rst 0x20), negated. Ends `pop af; ret`,
// returning past its immediate caller.
export function loc_5489(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x00) & 0xffff, 0x01); m.step(0x548d, 19); // 5489  ld (ix+0x00),0x01
  regs.xor(regs.a);                            m.step(0x548e, 4);
  mem.write8((regs.ix + 0x02) & 0xffff, regs.a); m.step(0x5491, 19); // 548e  ld (ix+0x02),a
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x5494, 19); // 5491  ld (ix+0x05),a
  mem.write8((regs.ix + 0x03) & 0xffff, 0x60); m.step(0x5498, 19); // 5494  ld (ix+0x03),0x60
  mem.write8((regs.ix + 0x04) & 0xffff, 0x1b); m.step(0x549c, 19); // 5498  ld (ix+0x04),0x1b
  mem.write8((regs.ix + 0x06) & 0xffff, regs.b); m.step(0x549f, 19); // 549c  ld (ix+0x06),b
  regs.a = mem.read8((regs.ix + 0x17) & 0xffff); m.step(0x54a2, 19); // 549f  ld a,(ix+0x17)
  regs.c = regs.a;                             m.step(0x54a3, 4);
  regs.hl = 0x5657;                            m.step(0x54a6, 10);
  m.push16(0x54a9);
  m.step(0x0c45, 17);           // 54a6  call 0x0c45 (word lookup -> DE)
  m.call(0x0c45);
  m.push16(0x54ac);
  m.step(0x381e, 17);           // 54a9  call 0x381e (set animation)
  m.call(0x381e);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x40); m.step(0x54b0, 19); // 54ac  ld (ix+0x11),0x40
  regs.a = regs.c;                             m.step(0x54b1, 4);
  regs.hl = 0x55d7;                            m.step(0x54b4, 10);
  m.push16(0x54b5);
  m.step(0x0020, 11);           // 54b4  rst 0x20 (HL += A; A = (HL))
  m.call(0x0020);
  regs.a = mem.read8(0x8907);                  m.step(0x54b8, 13); // 54b5  ld a,(0x8907)
  regs.and(0x07);                              m.step(0x54ba, 7);
  regs.c = regs.a;                             m.step(0x54bb, 4);
  regs.add(regs.a);                            m.step(0x54bc, 4);
  regs.add(regs.c);                            m.step(0x54bd, 4);  // A = 3*(0x8907&7)
  m.push16(0x54be);
  m.step(0x0020, 11);           // 54bd  rst 0x20 (HL += A; A = (HL))
  m.call(0x0020);
  regs.neg();                                  m.step(0x54c0, 8);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a); m.step(0x54c3, 19); // 54c0  ld (ix+0x0a),a
  regs.af = m.pop16();                         m.step(0x54c4, 10); // 54c3  pop af -- drop immediate-caller return
  return m.ret(10); // 54c4  ret -- to caller's caller
}
