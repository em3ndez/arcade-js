// SPDX-License-Identifier: GPL-3.0-only
// loc_2cc2 (ROM 0x2cc2-0x2ce9) -- arms $87/$42/$43/$34,X (+$b7 unless $86 negative), zeroes $b2-$b5/$b8, returns C=0; C=1 bails to $2ca6.
export function loc_2cc2(m) {
  const { regs, mem } = m;
  if (regs.fC) { m.step(0x2ca6, 3); return m.ret(6); }                                               // 2cc2 bcs $2ca6 -> RTS @2ca6
  m.step(0x2cc4, 2);
  regs.a = 0x30; regs.setNZ(regs.a); m.step(0x2cc6, 2);                                              // 2cc4 lda #$30
  mem.write8(0x0087, regs.a); m.step(0x2cc8, 3);                                                     // 2cc6 sta $87
  regs.a = 0x20; regs.setNZ(regs.a); m.step(0x2cca, 2);                                              // 2cc8 lda #$20
  mem.write8(0x0043, regs.a); m.step(0x2ccc, 3);                                                     // 2cca sta $43
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x2cce, 2);                                              // 2ccc lda #$ff
  mem.write8((0x0034 + regs.x) & 0xff, regs.a); m.step(0x2cd0, 4);                                   // 2cce sta $34,x
  regs.a = 0x28; regs.setNZ(regs.a); m.step(0x2cd2, 2);                                              // 2cd0 lda #$28
  mem.write8(0x0042, regs.a); m.step(0x2cd4, 3);                                                     // 2cd2 sta $42
  regs.a = mem.read8(0x0086); regs.setNZ(regs.a); m.step(0x2cd6, 3);                                 // 2cd4 lda $86
  if (regs.fN) { m.step(0x2cdc, 3); }                                                                // 2cd6 bmi $2cdc
  else {
    m.step(0x2cd8, 2);
    regs.a = 0x13; regs.setNZ(regs.a); m.step(0x2cda, 2);                                            // 2cd8 lda #$13
    mem.write8(0x00b7, regs.a); m.step(0x2cdc, 3);                                                   // 2cda sta $b7
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2cde, 2);                                              // 2cdc lda #$00
  mem.write8(0x00b2, regs.a); m.step(0x2ce0, 3);                                                     // 2cde sta $b2
  mem.write8(0x00b3, regs.a); m.step(0x2ce2, 3);
  mem.write8(0x00b4, regs.a); m.step(0x2ce4, 3);
  mem.write8(0x00b5, regs.a); m.step(0x2ce6, 3);
  mem.write8(0x00b8, regs.a); m.step(0x2ce8, 3);                                                     // 2ce6 sta $b8
  regs.clc(); m.step(0x2ce9, 2);                                                                     // 2ce8 clc
  return m.ret(6);                                                                                   // 2ce9 rts
}
