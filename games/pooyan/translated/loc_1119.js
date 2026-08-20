// SPDX-License-Identifier: GPL-3.0-only

// loc_1119  (ROM 0x1119-0x1130) -- draw a byte A as two stacked digit tiles at HL.
// High nibble -> mem[HL] (0x10 blank tile when zero, i.e. leading-zero suppression); then HL
// moves one row up (HL += 0xffe0) and the low nibble -> mem[HL]. Leaf, no calls.
export function loc_1119(m) {
  const { regs, mem } = m;

  regs.bc = 0xffe0;                  m.step(0x111c, 10);
  regs.e = regs.a;                   m.step(0x111d, 4);
  regs.a = regs.srl(regs.a);         m.step(0x111f, 8);
  regs.a = regs.srl(regs.a);         m.step(0x1121, 8);
  regs.a = regs.srl(regs.a);         m.step(0x1123, 8);
  regs.a = regs.srl(regs.a);         m.step(0x1125, 8); // A = high nibble
  regs.and(regs.a);                  m.step(0x1126, 4);
  if (regs.fNZ) {
    m.step(0x112a, 12);              // jr nz -- nonzero high digit
  } else {
    m.step(0x1128, 7);               // jr nz not taken
    regs.a = 0x10;                   m.step(0x112a, 7); // blank tile for a leading zero
  }
  mem.write8(regs.hl, regs.a);       m.step(0x112b, 7);
  regs.addHl(regs.bc);               m.step(0x112c, 11); // one row up
  regs.a = regs.e;                   m.step(0x112d, 4);
  regs.and(0x0f);                    m.step(0x112f, 7);  // A = low nibble
  mem.write8(regs.hl, regs.a);       m.step(0x1130, 7);
  m.ret(10);
}
