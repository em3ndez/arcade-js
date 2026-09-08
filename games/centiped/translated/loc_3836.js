// SPDX-License-Identifier: GPL-3.0-only
// loc_3836 (ROM 0x3836-0x384f) -- writes A (EOR $ef unless A=0) through the ($91) pointer, then advances that 16-bit pointer by (0x20 ^ $ef)+C and $f3+$92
export function loc_3836(m) {
  const { regs, mem } = m;
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3837, 2);                              // 3836 tay
  if (regs.fZ) {
    m.step(0x383b, 3);                                                                 // 3837 beq $383b (taken)
  } else {
    m.step(0x3839, 2);                                                                 // 3837 beq $383b (not taken)
    regs.eor(mem.read8(0x00ef)); m.step(0x383b, 3);                                    // 3839 eor $ef
  }
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x383d, 2);                                // 383b ldy #$00
  mem.write8((mem.read16(0x0091) + regs.y) & 0xffff, regs.a); m.step(0x383f, 6);       // 383d sta ($91),y
  regs.a = 0x20; regs.setNZ(regs.a); m.step(0x3841, 2);                                // 383f lda #$20
  regs.eor(mem.read8(0x00ef)); m.step(0x3843, 3);                                      // 3841 eor $ef
  regs.clc(); m.step(0x3844, 2);                                                       // 3843 clc
  regs.adc(mem.read8(0x0091)); m.step(0x3846, 3);                                      // 3844 adc $91
  mem.write8(0x0091, regs.a); m.step(0x3848, 3);                                       // 3846 sta $91
  regs.a = mem.read8(0x00f3); regs.setNZ(regs.a); m.step(0x384a, 3);                   // 3848 lda $f3
  regs.adc(mem.read8(0x0092)); m.step(0x384c, 3);                                      // 384a adc $92
  mem.write8(0x0092, regs.a); m.step(0x384e, 3);                                       // 384c sta $92
  return m.ret(6);                                                                     // 384e rts
}
