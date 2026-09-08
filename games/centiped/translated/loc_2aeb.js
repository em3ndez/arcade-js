// SPDX-License-Identifier: GPL-3.0-only
// loc_2aeb  (ROM 0x2aeb-0x2b24) -- ADC $63, clamp the sum into [0x0B,0xF4] (unless the $2C2B check is
// non-zero, which reloads $63) and store $63; if $86<0 RTS, else clear $BB, call $382D/$3226, add into
// $85 and fall through to loc_2b24.
export function loc_2aeb(m) {
  const { regs, mem } = m;
  regs.adc(mem.read8(0x0063)); m.step(0x2aed, 3);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x2aee, 2);
  mem.write8(0x008b, regs.a); m.step(0x2af0, 3);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2af2, 2);
  regs.a = mem.read8(0x0073); regs.setNZ(regs.a); m.step(0x2af4, 3);
  m.step(0x2af7, 6); m.call(0x2c2b);                                     // 2af4 jsr $2c2b
  let at2b0c = false;
  if (regs.fNZ) {
    m.step(0x2b0a, 4);                                                   // 2af7 bne $2b0a (taken)
  } else {
    m.step(0x2af9, 2);                                                   // 2af7 bne (not taken)
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0x2afa, 2);
    regs.cmp(0xf4); m.step(0x2afc, 2);                                   // 2afa cmp #$f4
    if (regs.fNC) {
      m.step(0x2b02, 4);                                                 // 2afc bcc $2b02 (taken)
    } else {
      m.step(0x2afe, 2);                                                 // 2afc bcc (not taken)
      regs.a = 0xf4; regs.setNZ(regs.a); m.step(0x2b00, 2);              // 2afe lda #$f4
      if (regs.fNZ) { m.step(0x2b0c, 3); at2b0c = true; }                // 2b00 bne $2b0c (taken)
      else { m.step(0x2b02, 2); }                                        // 2b00 bne (not taken)
    }
    if (!at2b0c) {
      regs.cmp(0x0b); m.step(0x2b04, 2);                                 // 2b02 cmp #$0b
      if (regs.fC) { m.step(0x2b0c, 3); at2b0c = true; }                 // 2b04 bcs $2b0c (taken)
      else {
        m.step(0x2b06, 2);                                              // 2b04 bcs (not taken)
        regs.a = 0x0b; regs.setNZ(regs.a); m.step(0x2b08, 2);            // 2b06 lda #$0b
        if (regs.fNZ) { m.step(0x2b0c, 3); at2b0c = true; }              // 2b08 bne $2b0c (taken)
        else { m.step(0x2b0a, 2); }                                      // 2b08 bne (not taken)
      }
    }
  }
  if (!at2b0c) {
    regs.a = mem.read8(0x0063); regs.setNZ(regs.a); m.step(0x2b0c, 3);   // 2b0a lda $63
  }
  mem.write8(0x0063, regs.a); m.step(0x2b0e, 3);
  regs.y = mem.read8(0x0086); regs.setNZ(regs.y); m.step(0x2b10, 3);     // 2b0e ldy $86
  if (regs.fPl) { m.step(0x2b13, 3); }                                   // 2b10 bpl $2b13 (taken)
  else { m.step(0x2b12, 2); return m.ret(6); }                          // 2b10 bpl (nt) -> 2b12 rts
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2b15, 2);
  regs.a = mem.read8(0x00bb); regs.setNZ(regs.a); m.step(0x2b17, 3);     // 2b15 lda $bb
  mem.write8(0x00bb, regs.y); m.step(0x2b19, 3);
  m.step(0x2b1c, 6); m.call(0x382d);                                     // 2b19 jsr $382d
  m.step(0x2b1f, 6); m.call(0x3226);                                     // 2b1c jsr $3226
  regs.adc(mem.read8(0x0085)); m.step(0x2b21, 3);                        // 2b1f adc $85
  mem.write8(0x0085, regs.a); m.step(0x2b23, 3);                         // 2b21 sta $85
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2b24, 2);
  return m.call(0x2b24);                                                 // fall through to loc_2b24
}
