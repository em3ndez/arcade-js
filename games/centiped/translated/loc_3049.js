// SPDX-License-Identifier: GPL-3.0-only
// loc_3049  (ROM 0x3049-0x3068) -- if ($94,X | $87)==0 bumps $9c,X and sets $87:=$40; else range-tests
// $41^$ef against $9c, on overflow decrements $9f and (at zero) JSRs loc_21c7; RTS on all paths.
export function loc_3049(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x304b, 3);                              // 3049 ldx $88
  regs.a = mem.read8((0x0094 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x304d, 4);            // 304b lda $94,x
  regs.ora(mem.read8(0x0087)); m.step(0x304f, 3);                                                 // 304d ora $87
  if (regs.fZ) {                                                                                  // 304f beq $3061
    m.step(0x3061, 3);
    mem.write8((0x009c + regs.x) & 0xff, regs.inc8(mem.read8((0x009c + regs.x) & 0xff))); m.step(0x3063, 6); // 3061 inc $9c,x
    regs.a = 0x40; regs.setNZ(regs.a); m.step(0x3065, 2);                                         // 3063 lda #$40
    mem.write8(0x0087, regs.a); m.step(0x3067, 3);                                                // 3065 sta $87
    return m.ret(6);                                                                              // 3067 rts
  }
  m.step(0x3051, 2);
  regs.a = mem.read8(0x0041); regs.setNZ(regs.a); m.step(0x3053, 3);                              // 3051 lda $41
  regs.eor(mem.read8(0x00ef)); m.step(0x3055, 3);                                                 // 3053 eor $ef
  regs.cmp(0x9c); m.step(0x3057, 2);                                                              // 3055 cmp #$9c
  if (regs.fNC) {                                                                                 // 3057 bcc $3060
    m.step(0x3060, 3);
    return m.ret(6);                                                                              // 3060 rts
  }
  m.step(0x3059, 2);
  mem.write8(0x009f, regs.dec8(mem.read8(0x009f))); m.step(0x305b, 5);                            // 3059 dec $9f
  if (regs.fNZ) {                                                                                 // 305b bne $3060
    m.step(0x3060, 3);
    return m.ret(6);                                                                              // 3060 rts
  }
  m.step(0x305d, 2);
  m.step(0x3060, 6); m.call(0x21c7);                                                              // 305d jsr $21c7
  return m.ret(6);                                                                                // 3060 rts
}
