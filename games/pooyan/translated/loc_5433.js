// SPDX-License-Identifier: GPL-3.0-only

// loc_5433  (ROM 0x5433-0x5488) -- initialize one enemy object block at IX. Bails if the block is
// already live ((ix+0)|(ix+1) != 0 -> ret nz). Otherwise seeds the block: active flag (ix+0)=1,
// zeroes (ix+2)/(ix+5)/(ix+0e), position/state (ix+3)=0x60,(ix+4)=0x1b. The level index at 0x8d01
// (C) indexes two byte tables (0x55d4, 0x55d7) via rst 0x20 (loc_0020) for (ix+6) and -(ix+0a);
// two word tables (0x561f, 0x5657) via loc_0c45 give the animation-script byte at (ix+17) and the
// script pointer (ix+0c/0d). Frame-hold (ix+11)=0x40, run one animation tick (loc_4006), then bump
// the level index and store it back to 0x8d01. C (the level index) is preserved across all callees.
export function loc_5433(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);   m.step(0x5436, 19); // ld a,(ix+0)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff));   m.step(0x5439, 19); // or (ix+1)
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- block already active
  m.step(0x543a, 5);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);     m.step(0x543e, 19);
  regs.xor(regs.a);                                m.step(0x543f, 4);  // A = 0
  mem.write8((regs.ix + 0x02) & 0xffff, regs.a);   m.step(0x5442, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);   m.step(0x5445, 19);
  mem.write8((regs.ix + 0x03) & 0xffff, 0x60);     m.step(0x5449, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, 0x1b);     m.step(0x544d, 19);
  mem.write8((regs.ix + 0x0e) & 0xffff, regs.a);   m.step(0x5450, 19);
  regs.hl = 0x55d4;                                m.step(0x5453, 10);
  regs.a = mem.read8(0x8d01);                      m.step(0x5456, 13);
  regs.c = regs.a;                                 m.step(0x5457, 4);  // C = level index
  m.push16(0x5458);
  m.step(0x0020, 11);                              // 5457  rst 0x20 (loc_0020: A = mem[0x55d4 + A])
  m.call(0x0020);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a);   m.step(0x545b, 19);
  regs.hl = 0x55d7;                                m.step(0x545e, 10);
  regs.a = regs.c;                                 m.step(0x545f, 4);
  m.push16(0x5460);
  m.step(0x0020, 11);                              // 545f  rst 0x20 (loc_0020: A = mem[0x55d7 + C])
  m.call(0x0020);
  regs.neg();                                      m.step(0x5462, 8);  // A = -A
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);   m.step(0x5465, 19);
  regs.hl = 0x561f;                                m.step(0x5468, 10);
  regs.a = regs.c;                                 m.step(0x5469, 4);
  m.push16(0x546c);
  m.step(0x0c45, 17);                              // 5469  call 0x0c45 (DE = word table[C])
  m.call(0x0c45);
  regs.a = mem.read8(regs.de);                     m.step(0x546d, 7);
  mem.write8((regs.ix + 0x17) & 0xffff, regs.a);   m.step(0x5470, 19);
  regs.hl = 0x5657;                                m.step(0x5473, 10);
  m.push16(0x5476);
  m.step(0x0c45, 17);                              // 5473  call 0x0c45 (index A = the byte read at 0x546c)
  m.call(0x0c45);
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.e);   m.step(0x5479, 19);
  mem.write8((regs.ix + 0x0d) & 0xffff, regs.d);   m.step(0x547c, 19); // (ix+0c/0d) = script pointer
  mem.write8((regs.ix + 0x11) & 0xffff, 0x40);     m.step(0x5480, 19);
  m.push16(0x5483);
  m.step(0x4006, 17);                              // 5480  call 0x4006 (animation tick; preserves C)
  m.call(0x4006);
  regs.a = regs.c;                                 m.step(0x5484, 4);
  regs.a = regs.inc8(regs.a);                      m.step(0x5485, 4);  // A = level index + 1
  mem.write8(0x8d01, regs.a);                      m.step(0x5488, 13);

  m.ret(); // 5488  ret
}
