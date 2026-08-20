// SPDX-License-Identifier: GPL-3.0-only

// loc_6048  (ROM 0x6048-0x6068) -- entered via `call 0x6048` (0x603c). Picks one of two IX
// sprite blocks by the I-reg zero test (0x8c90 when I==0 else 0x8ca8), gates on that block's
// byte 0 (ret if 0, ret if ==3), stores it at 0x8d44, then arms IX=0x8868 / B=5 / HL=0x8b70
// and falls through into loc_6069.
export function loc_6048(m) {
  const { regs, mem } = m;

  regs.ix = 0x8c90;                                m.step(0x604c, 14);
  regs.ldAI();                                     m.step(0x604e, 9);  // A <- I
  regs.and(regs.a);                                m.step(0x604f, 4);
  if (regs.fZ) {
    m.step(0x6055, 12);                            // jr z taken
  } else {
    m.step(0x6051, 7);                             // jr z not taken
    regs.ix = 0x8ca8;                              m.step(0x6055, 14);
  }
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);   m.step(0x6058, 19);
  regs.and(regs.a);                                m.step(0x6059, 4);
  if (regs.fZ) { return m.ret(11); }               // ret z -- block byte 0 == 0
  m.step(0x605a, 5);
  regs.cp(0x03);                                   m.step(0x605c, 7);
  if (regs.fZ) { return m.ret(11); }               // ret z -- block byte 0 == 3
  m.step(0x605d, 5);
  mem.write8(0x8d44, regs.a);                      m.step(0x6060, 13);
  regs.ix = 0x8868;                                m.step(0x6064, 14);
  regs.b = 0x05;                                   m.step(0x6066, 7);
  regs.hl = 0x8b70;                                m.step(0x6069, 10);
  return m.call(0x6069); // fall through into loc_6069
}
