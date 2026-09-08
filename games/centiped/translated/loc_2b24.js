// SPDX-License-Identifier: GPL-3.0-only
// loc_2b24  (ROM 0x2b24-0x2b60) -- ADC $73, then (unless the $2C2B check is non-zero, which reloads $73)
// clamp the sum through the ladder {<0x08->0x08, >=0xF1->0xF0, <0x31 keep, <0x80->0x30, >=0xC8 keep,
// else 0xC8} and store $73; if $86>=0 fall through to loc_2b60, else RTS.
export function loc_2b24(m) {
  const { regs, mem } = m;
  regs.adc(mem.read8(0x0073)); m.step(0x2b26, 3);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x2b27, 2);
  regs.y = mem.read8(0x0063); regs.setNZ(regs.y); m.step(0x2b29, 3);
  mem.write8(0x008b, regs.y); m.step(0x2b2b, 3);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2b2d, 2);
  m.push16(0x2b2f); m.step(0x2b30, 6); m.call(0x2c2b);                                     // 2b2d jsr $2c2b
  let jump = null; // the merge address a forward branch jumped to, or null while flowing sequentially
  if (regs.fNZ) { m.step(0x2b57, 3); jump = 0x2b57; }                    // 2b30 bne $2b57 (taken)
  else { m.step(0x2b32, 2); }                                            // 2b30 bne (not taken)
  if (jump === null) {
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0x2b33, 2);
    regs.cmp(0x08); m.step(0x2b35, 2);
    if (regs.fNC) { m.step(0x2b53, 3); jump = 0x2b53; }                  // 2b35 bcc $2b53 (taken)
    else { m.step(0x2b37, 2); }                                          // 2b35 bcc (not taken)
  }
  if (jump === null) {
    regs.cmp(0xf1); m.step(0x2b39, 2);
    if (regs.fC) { m.step(0x2b4f, 3); jump = 0x2b4f; }                   // 2b39 bcs $2b4f (taken)
    else { m.step(0x2b3b, 2); }                                          // 2b39 bcs (not taken)
  }
  if (jump === null) {
    regs.cmp(0x80); m.step(0x2b3d, 2);
    if (regs.fNC) { m.step(0x2b47, 3); jump = 0x2b47; }                  // 2b3d bcc $2b47 (taken)
    else { m.step(0x2b3f, 2); }                                          // 2b3d bcc (not taken)
  }
  if (jump === null) {
    regs.cmp(0xc8); m.step(0x2b41, 2);
    if (regs.fC) { m.step(0x2b59, 3); jump = 0x2b59; }                   // 2b41 bcs $2b59 (taken)
    else { m.step(0x2b43, 2); }                                          // 2b41 bcs (not taken)
  }
  if (jump === null) {
    regs.a = 0xc8; regs.setNZ(regs.a); m.step(0x2b45, 2);                // 2b43 lda #$c8
    if (regs.fNZ) { m.step(0x2b59, 3); jump = 0x2b59; }                  // 2b45 bne $2b59 (taken)
    else { m.step(0x2b47, 2); }                                          // 2b45 bne (not taken)
  }
  if (jump === 0x2b47) jump = null;                                      // land at 0x2b47
  if (jump === null) {
    regs.cmp(0x31); m.step(0x2b49, 2);                                   // 2b47 cmp #$31
    if (regs.fNC) { m.step(0x2b59, 3); jump = 0x2b59; }                  // 2b49 bcc $2b59 (taken)
    else { m.step(0x2b4b, 2); }                                          // 2b49 bcc (not taken)
  }
  if (jump === null) {
    regs.a = 0x30; regs.setNZ(regs.a); m.step(0x2b4d, 2);                // 2b4b lda #$30
    if (regs.fNZ) { m.step(0x2b59, 3); jump = 0x2b59; }                  // 2b4d bne $2b59 (taken)
    else { m.step(0x2b4f, 2); }                                          // 2b4d bne (not taken)
  }
  if (jump === 0x2b4f) jump = null;                                      // land at 0x2b4f
  if (jump === null) {
    regs.a = 0xf0; regs.setNZ(regs.a); m.step(0x2b51, 2);                // 2b4f lda #$f0
    if (regs.fNZ) { m.step(0x2b59, 3); jump = 0x2b59; }                  // 2b51 bne $2b59 (taken)
    else { m.step(0x2b53, 2); }                                          // 2b51 bne (not taken)
  }
  if (jump === 0x2b53) jump = null;                                      // land at 0x2b53
  if (jump === null) {
    regs.a = 0x08; regs.setNZ(regs.a); m.step(0x2b55, 2);                // 2b53 lda #$08
    if (regs.fNZ) { m.step(0x2b59, 3); jump = 0x2b59; }                  // 2b55 bne $2b59 (taken)
    else { m.step(0x2b57, 2); }                                          // 2b55 bne (not taken)
  }
  if (jump === 0x2b57) jump = null;                                      // land at 0x2b57
  if (jump === null) {
    regs.a = mem.read8(0x0073); regs.setNZ(regs.a); m.step(0x2b59, 3);   // 2b57 lda $73
  }
  mem.write8(0x0073, regs.a); m.step(0x2b5b, 3);                         // 2b59 sta $73
  regs.y = mem.read8(0x0086); regs.setNZ(regs.y); m.step(0x2b5d, 3);     // 2b5b ldy $86
  if (regs.fPl) { m.step(0x2b60, 3); return m.call(0x2b60); }            // 2b5d bpl $2b60 (out -> loc_2b60)
  m.step(0x2b5f, 2);                                                     // 2b5d bpl (not taken)
  return m.ret(6);                                                       // 2b5f rts
}
