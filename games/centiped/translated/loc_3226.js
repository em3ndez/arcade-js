// SPDX-License-Identifier: GPL-3.0-only
// loc_3226 (ROM 0x3226-0x323e) -- clamps A into [0x08,0xf8), then Y = sign-carry pack; RTS.
export function loc_3226(m) {
  const { regs } = m;
  regs.cmp(0x08); m.step(0x3228, 2);                            // 3226 cmp #$08
  if (regs.fNC) {                                               // 3228 bcc $3236
    m.step(0x3236, 3);
  } else {
    m.step(0x322a, 2);
    regs.cmp(0xf8); m.step(0x322c, 2);                          // 322a cmp #$f8
    if (regs.fC) {                                              // 322c bcs $3236
      m.step(0x3236, 3);
    } else {
      m.step(0x322e, 2);
      regs.cmp(0x80); m.step(0x3230, 2);                        // 322e cmp #$80
      regs.a = 0x08; regs.setNZ(regs.a); m.step(0x3232, 2);     // 3230 lda #$08
      if (regs.fNC) {                                           // 3232 bcc $3236
        m.step(0x3236, 3);
      } else {
        m.step(0x3234, 2);
        regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x3236, 2);   // 3234 lda #$f8
      }
    }
  }
  regs.cmp(0x80); m.step(0x3238, 2);                            // 3236 cmp #$80
  regs.a = regs.ror(regs.a); m.step(0x3239, 2);                 // 3238 ror a
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x323a, 2);       // 3239 tay
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x323c, 2);         // 323a lda #$00
  regs.a = regs.ror(regs.a); m.step(0x323d, 2);                 // 323c ror a
  return m.ret(6);                                              // 323d rts
}
