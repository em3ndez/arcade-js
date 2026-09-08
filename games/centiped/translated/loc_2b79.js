// SPDX-License-Identifier: GPL-3.0-only
// loc_2b79  (ROM 0x2b79-0x2b91) -- $72 = $73 + (4 ^ $f0); copy $63 into $62; if ($43 & $af) set $42=$28; RTS.
export function loc_2b79(m) {
  const { regs, mem } = m;
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x2b7b, 2);                // 2b79 lda #$04
  regs.eor(mem.read8(0x00f0)); m.step(0x2b7d, 3);                      // 2b7b eor $f0
  regs.clc(); m.step(0x2b7e, 2);                                       // 2b7d clc
  regs.adc(mem.read8(0x0073)); m.step(0x2b80, 3);                      // 2b7e adc $73
  mem.write8(0x0072, regs.a); m.step(0x2b82, 3);                       // 2b80 sta $72
  regs.a = mem.read8(0x0063); regs.setNZ(regs.a); m.step(0x2b84, 3);   // 2b82 lda $63
  mem.write8(0x0062, regs.a); m.step(0x2b86, 3);                       // 2b84 sta $62
  regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2b88, 3);   // 2b86 lda $43
  regs.and(0xaf); m.step(0x2b8a, 2);                                   // 2b88 and #$af
  if (regs.fZ) {                                                       // 2b8a beq $2b90 (taken)
    m.step(0x2b90, 3);
    return m.ret(6);                                                   // 2b90 rts
  }
  m.step(0x2b8c, 2);                                                   // 2b8a beq $2b90 (not taken)
  regs.a = 0x28; regs.setNZ(regs.a); m.step(0x2b8e, 2);                // 2b8c lda #$28
  mem.write8(0x0042, regs.a); m.step(0x2b90, 3);                       // 2b8e sta $42
  return m.ret(6);                                                     // 2b90 rts
}

// Second entry at 0x2b86 (loc_2b60's `bcs $2b86`): re-emits the $43-mask tail of loc_2b79 above.
export function loc_2b86(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2b88, 3);
  regs.and(0xaf); m.step(0x2b8a, 2);
  if (regs.fZ) {
    m.step(0x2b90, 3);
    return m.ret(6);
  }
  m.step(0x2b8c, 2);
  regs.a = 0x28; regs.setNZ(regs.a); m.step(0x2b8e, 2);
  mem.write8(0x0042, regs.a); m.step(0x2b90, 3);
  return m.ret(6);
}
