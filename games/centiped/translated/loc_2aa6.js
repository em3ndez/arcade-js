// SPDX-License-Identifier: GPL-3.0-only
// loc_2aa6  (ROM 0x2aa6-0x2ac7) -- steps a segment's $44+X delta through $382d, folds it into $74+X and
// the $54+X coordinate (adding +4 or -4 by the $44+X sign). NO RTS: exits/falls through to loc_2ac7.
export function loc_2aa6(m) {
  const { regs, mem } = m;
  regs.a = mem.read8((0x44 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2aa8, 4); // 2aa6 lda $44,x
  m.step(0x2aab, 6); m.call(0x382d);                                                 // 2aa8 jsr $382d
  mem.write8((0x44 + regs.x) & 0xff, regs.a); m.step(0x2aad, 4);                      // 2aab sta $44,x
  regs.y = mem.read8((0x74 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x2aaf, 4);  // 2aad ldy $74,x
  if (regs.fNZ) { m.step(0x2ac7, 3); return m.call(0x2ac7); }                         // 2aaf bne $2ac7
  m.step(0x2ab1, 2);                                                                  // 2aaf bne (fall)
  regs.ora(0x00); m.step(0x2ab3, 2);                                                  // 2ab1 ora #$00
  if (regs.fN) {
    m.step(0x2ab8, 3);                                                                // 2ab3 bmi $2ab8
  } else {
    m.step(0x2ab5, 2);                                                                // 2ab3 bmi (fall)
    m.step(0x2ab8, 6); m.call(0x382d);                                                // 2ab5 jsr $382d
  }
  mem.write8((0x74 + regs.x) & 0xff, regs.a); m.step(0x2aba, 4);                      // 2ab8 sta $74,x
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x2abc, 2);                               // 2aba lda #$04
  regs.y = mem.read8((0x44 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x2abe, 4);  // 2abc ldy $44,x
  if (regs.fPl) {
    m.step(0x2ac2, 3);                                                                // 2abe bpl $2ac2
  } else {
    m.step(0x2ac0, 2);                                                                // 2abe bpl (fall)
    regs.a = 0xfc; regs.setNZ(regs.a); m.step(0x2ac2, 2);                             // 2ac0 lda #$fc
  }
  regs.clc(); m.step(0x2ac3, 2);                                                      // 2ac2 clc
  regs.adc(mem.read8((0x54 + regs.x) & 0xff)); m.step(0x2ac5, 4);                     // 2ac3 adc $54,x
  mem.write8((0x54 + regs.x) & 0xff, regs.a); m.step(0x2ac7, 4);                      // 2ac5 sta $54,x
  return m.call(0x2ac7);                                                              // fall-through into loc_2ac7
}
