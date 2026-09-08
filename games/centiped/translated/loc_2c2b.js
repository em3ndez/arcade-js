// SPDX-License-Identifier: GPL-3.0-only
// loc_2c2b (ROM 0x2c2b-0x2c6a) -- from A and Y builds the ($32) tile-map pointer, clamps the column, wraps the top row, then fetches that cell and (nonzero) folds $ef in.
export function loc_2c2b(m) {
  const { regs, mem } = m;
  regs.a = regs.lsr(regs.a); m.step(0x2c2c, 2);                                                      // 2c2b lsr a
  regs.a = regs.lsr(regs.a); m.step(0x2c2d, 2);
  regs.a = regs.lsr(regs.a); m.step(0x2c2e, 2);                                                      // 2c2d lsr a
  regs.adc(0x00); m.step(0x2c30, 2);                                                                 // 2c2e adc #$00
  mem.write8(0x0032, regs.a); m.step(0x2c32, 3);                                                     // 2c30 sta $32
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0x2c34, 2);
  mem.write8(0x0033, regs.a); m.step(0x2c36, 3);                                                     // 2c34 sta $33
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2c37, 2);
  regs.a = regs.asl(regs.a); m.step(0x2c38, 2);                                                      // 2c37 asl a
  regs.a = regs.asl(regs.a); m.step(0x2c39, 2);
  regs.a = regs.asl(regs.a); m.step(0x2c3a, 2);                                                      // 2c39 asl a
  regs.clc(); m.step(0x2c3b, 2);                                                                     // 2c3a clc
  regs.adc(mem.read8(0x008b)); m.step(0x2c3d, 3);                                                    // 2c3b adc $8b
  mem.write8(0x008b, regs.a); m.step(0x2c3f, 3);                                                     // 2c3d sta $8b
  regs.a = 0xf7; regs.setNZ(regs.a); m.step(0x2c41, 2);                                              // 2c3f lda #$f7
  regs.sec(); m.step(0x2c42, 2);                                                                     // 2c41 sec
  regs.sbc(mem.read8(0x008b)); m.step(0x2c44, 3);                                                    // 2c42 sbc $8b
  if (regs.fC) { m.step(0x2c48, 3); }                                                                // 2c44 bcs $2c48
  else {
    m.step(0x2c46, 2);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2c48, 2);
  }
  regs.and(0xf8); m.step(0x2c4a, 2);                                                                 // 2c48 and #$f8
  regs.a = regs.asl(regs.a); m.step(0x2c4b, 2);                                                      // 2c4a asl a
  mem.write8(0x0033, regs.rol(mem.read8(0x0033))); m.step(0x2c4d, 5);                                // 2c4b rol $33
  regs.a = regs.asl(regs.a); m.step(0x2c4e, 2);
  mem.write8(0x0033, regs.rol(mem.read8(0x0033))); m.step(0x2c50, 5);                                // 2c4e rol $33
  regs.ora(mem.read8(0x0032)); m.step(0x2c52, 3);                                                    // 2c50 ora $32
  regs.y = mem.read8(0x0033); regs.setNZ(regs.y); m.step(0x2c54, 3);                                 // 2c52 ldy $33
  regs.cpy(0x07); m.step(0x2c56, 2);                                                                 // 2c54 cpy #$07
  if (regs.fNZ) { m.step(0x2c60, 3); }                                                               // 2c56 bne $2c60
  else {
    m.step(0x2c58, 2);
    regs.cmp(0xc0); m.step(0x2c5a, 2);                                                               // 2c58 cmp #$c0
    if (regs.fNC) { m.step(0x2c60, 3); }                                                             // 2c5a bcc $2c60
    else {
      m.step(0x2c5c, 2);
      regs.and(0x1f); m.step(0x2c5e, 2);                                                             // 2c5c and #$1f
      regs.ora(0xa0); m.step(0x2c60, 2);                                                             // 2c5e ora #$a0
    }
  }
  mem.write8(0x0032, regs.a); m.step(0x2c62, 3);                                                     // 2c60 sta $32
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2c64, 2);                                              // 2c62 ldy #$00
  regs.a = mem.read8((mem.read16(0x0032) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x2c66, 5); // 2c64 lda ($32),y
  if (regs.fZ) { m.step(0x2c6a, 3); return m.ret(6); }                                               // 2c66 beq $2c6a
  m.step(0x2c68, 2);
  regs.eor(mem.read8(0x00ef)); m.step(0x2c6a, 3);                                                    // 2c68 eor $ef
  return m.ret(6);                                                                                   // 2c6a rts
}
