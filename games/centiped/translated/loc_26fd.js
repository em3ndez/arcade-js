// SPDX-License-Identifier: GPL-3.0-only
// loc_26fd  (ROM 0x26fd-0x2740) -- scans the $34..$41 timer bytes (X: 13..0): at $F9 reloads $41 from
// $D7^$EF, decrements a $FA cell, then advances the $43 counter and arms $DA/$DB at wrap; RTS.
export function loc_26fd(m) {
  const { regs, mem } = m;
  regs.x = 0x0d; regs.setNZ(regs.x); m.step(0x26ff, 2);
  for (;;) {
    regs.y = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x2701, 4);
    regs.cpy(0xf9); m.step(0x2703, 2);                                                 // 2701 cpy #$f9
    if (regs.fNC) {                                                                    // 2703 bcc $271d (taken)
      m.step(0x271d, 3);
    } else {
      m.step(0x2705, 2);                                                              // 2703 bcc (not taken)
      regs.cpy(0xfa); m.step(0x2707, 2);                                              // 2705 cpy #$fa
      let reach270d = false;
      if (regs.fNC) {                                                                 // 2707 bcc $270d (taken)
        m.step(0x270d, 3); reach270d = true;
      } else {
        m.step(0x2709, 2);                                                            // 2707 bcc (not taken)
        mem.write8((0x34 + regs.x) & 0xff, regs.dec8(mem.read8((0x34 + regs.x) & 0xff))); m.step(0x270b, 6); // 2709 dec $34,x
        if (regs.fNZ) { m.step(0x271d, 3); }                                          // 270b bne $271d (taken)
        else { m.step(0x270d, 2); reach270d = true; }                                 // 270b bne (not taken)
      }
      if (reach270d) {
        regs.cpx(0x0d); m.step(0x270f, 2);                                            // 270d cpx #$0d
        if (regs.fNZ) {                                                               // 270f bne $271d (taken)
          m.step(0x271d, 3);
        } else {
          m.step(0x2711, 2);                                                          // 270f bne (not taken)
          regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2713, 3);
          regs.and(0xaf); m.step(0x2715, 2);
          if (regs.fNZ) {                                                             // 2715 bne $271d (taken)
            m.step(0x271d, 3);
          } else {
            m.step(0x2717, 2);                                                        // 2715 bne (not taken)
            regs.a = mem.read8(0x00d7); regs.setNZ(regs.a); m.step(0x2719, 3);
            regs.eor(mem.read8(0x00ef)); m.step(0x271b, 3);
            mem.write8(0x0041, regs.a); m.step(0x271d, 3);
          }
        }
      }
    }
    regs.x = regs.dec8(regs.x); m.step(0x271e, 2);                                     // 271d dex
    if (regs.fPl) { m.step(0x26ff, 4); continue; }                                     // 271e bpl $26ff (taken, page cross)
    m.step(0x2720, 2); break;                                                          // 271e bpl (not taken)
  }
  regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2722, 3);
  regs.and(0xaf); m.step(0x2724, 2);
  if (regs.fZ) { m.step(0x2740, 3); return m.ret(6); }                                 // 2724 beq $2740 (taken)
  m.step(0x2726, 2);                                                                   // 2724 beq (not taken)
  regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2728, 3);                   // 2726 lda $00
  regs.and(0x03); m.step(0x272a, 2);                                                   // 2728 and #$03
  if (regs.fNZ) { m.step(0x2740, 3); return m.ret(6); }                                // 272a bne $2740 (taken)
  m.step(0x272c, 2);                                                                   // 272a bne (not taken)
  regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x272e, 3);                   // 272c lda $43
  regs.cmp(0x28); m.step(0x2730, 2);                                                   // 272e cmp #$28
  if (regs.fC) { m.step(0x2740, 3); return m.ret(6); }                                 // 2730 bcs $2740 (taken)
  m.step(0x2732, 2);                                                                   // 2730 bcs (not taken)
  mem.write8(0x0043, regs.inc8(mem.read8(0x0043))); m.step(0x2734, 5);                 // 2732 inc $43
  regs.cmp(0x27); m.step(0x2736, 2);                                                   // 2734 cmp #$27
  if (regs.fNZ) { m.step(0x2740, 3); return m.ret(6); }                                // 2736 bne $2740 (taken)
  m.step(0x2738, 2);                                                                   // 2736 bne (not taken)
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x273a, 2);                                // 2738 lda #$00
  mem.write8(0x00da, regs.a); m.step(0x273c, 3);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x273e, 2);                                // 273c lda #$04
  mem.write8(0x00db, regs.a); m.step(0x2740, 3);                                       // 273e sta $db
  return m.ret(6);                                                                     // 2740 rts
}
