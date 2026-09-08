// SPDX-License-Identifier: GPL-3.0-only
// loc_2ace  (ROM 0x2ace-0x2aeb) -- if $86 is negative or ($43 & 0xAF) is nonzero, RTS; else swaps $B9
// with $FE, runs $3226, accumulates its result into $84, and leaves the old $B9 in A. Falls into loc_2aeb.
export function loc_2ace(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0086); regs.setNZ(regs.a); m.step(0x2ad0, 3);   // 2ace lda $86
  if (regs.fPl) {
    m.step(0x2ad3, 3);                                                 // 2ad0 bpl $2ad3
  } else {
    m.step(0x2ad2, 2);                                                 // 2ad0 bpl (fall)
    return m.ret(6);                                                   // 2ad2 rts
  }
  regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2ad5, 3);   // 2ad3 lda $43
  regs.and(0xaf); m.step(0x2ad7, 2);                                   // 2ad5 and #$af
  if (regs.fNZ) { m.step(0x2ad2, 3); return m.ret(6); }                // 2ad7 bne $2ad2 -> rts
  m.step(0x2ad9, 2);                                                   // 2ad7 bne (fall)
  regs.a = mem.read8(0x0073); regs.setNZ(regs.a); m.step(0x2adb, 3);   // 2ad9 lda $73
  mem.write8(0x008d, regs.a); m.step(0x2add, 3);                       // 2adb sta $8d
  regs.y = mem.read8(0x00fe); regs.setNZ(regs.y); m.step(0x2adf, 3);   // 2add ldy $fe
  regs.a = mem.read8(0x00b9); regs.setNZ(regs.a); m.step(0x2ae1, 3);   // 2adf lda $b9
  mem.write8(0x00b9, regs.y); m.step(0x2ae3, 3);                       // 2ae1 sty $b9
  m.push16(0x2ae5); m.step(0x2ae6, 6); m.call(0x3226);                                   // 2ae3 jsr $3226
  regs.adc(mem.read8(0x0084)); m.step(0x2ae8, 3);                      // 2ae6 adc $84
  mem.write8(0x0084, regs.a); m.step(0x2aea, 3);                       // 2ae8 sta $84
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2aeb, 2);              // 2aea tya
  return m.call(0x2aeb);                                               // fall-through into loc_2aeb
}
