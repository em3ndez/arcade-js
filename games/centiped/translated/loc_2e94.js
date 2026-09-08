// SPDX-License-Identifier: GPL-3.0-only
// loc_2e94  (ROM 0x2e94-0x2ec5) -- two entries: at 0x2e94, if ($EF^A)>=0xFA RTS (via loc_2ec5) else JMP
// loc_20e8; at 0x2e9d (reached by an external JMP), every 4th tick advances the $40 orientation, then if
// the $2C2B-folded $70 sits in [0x3C,0x40) writes ($EF^(A&0xFB)) through the ($32) pointer; RTS.
export function loc_2e94(m) {
  const { regs, mem } = m;
  if (m.pc !== 0x2e9d) {
    regs.eor(mem.read8(0x00ef)); m.step(0x2e96, 3);
    regs.cmp(0xfa); m.step(0x2e98, 2);
    if (regs.fC) { m.step(0x2ec5, 3); return m.call(0x2ec5); }           // 2e98 bcs $2ec5 (out -> rts)
    m.step(0x2e9a, 2);                                                   // 2e98 bcs (not taken)
    m.step(0x20e8, 3); return m.call(0x20e8);                            // 2e9a jmp $20e8 (out)
  }
  regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2e9f, 3);     // 2e9d lda $00
  regs.and(0x03); m.step(0x2ea1, 2);
  if (regs.fNZ) { m.step(0x2eb0, 3); }                                   // 2ea1 bne $2eb0 (taken)
  else {
    m.step(0x2ea3, 2);                                                   // 2ea1 bne (not taken)
    regs.a = mem.read8(0x0040); regs.setNZ(regs.a); m.step(0x2ea5, 3);
    regs.clc(); m.step(0x2ea6, 2);
    regs.adc(0x01); m.step(0x2ea8, 2);
    regs.and(0x03); m.step(0x2eaa, 2);
    regs.ora(0x30); m.step(0x2eac, 2);
    regs.eor(mem.read8(0x00ef)); m.step(0x2eae, 3);
    mem.write8(0x0040, regs.a); m.step(0x2eb0, 3);
  }
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2eb2, 2);                  // 2eb0 ldy #$00
  regs.a = mem.read8(0x0070); regs.setNZ(regs.a); m.step(0x2eb4, 3);     // 2eb2 lda $70
  m.push16(0x2eb6); m.step(0x2eb7, 6); m.call(0x2c2b);                                     // 2eb4 jsr $2c2b
  regs.cmp(0x40); m.step(0x2eb9, 2);                                     // 2eb7 cmp #$40
  if (regs.fC) { m.step(0x2ec5, 3); return m.call(0x2ec5); }             // 2eb9 bcs $2ec5 (out -> rts)
  m.step(0x2ebb, 2);                                                     // 2eb9 bcs (not taken)
  regs.cmp(0x3c); m.step(0x2ebd, 2);                                     // 2ebb cmp #$3c
  if (regs.fNC) { m.step(0x2ec5, 3); return m.call(0x2ec5); }            // 2ebd bcc $2ec5 (out -> rts)
  m.step(0x2ebf, 2);                                                     // 2ebd bcc (not taken)
  regs.and(0xfb); m.step(0x2ec1, 2);                                     // 2ebf and #$fb
  regs.eor(mem.read8(0x00ef)); m.step(0x2ec3, 3);                        // 2ec1 eor $ef
  mem.write8((mem.read16(0x0032) + regs.y) & 0xffff, regs.a); m.step(0x2ec5, 6); // 2ec3 sta ($32),y
  return m.call(0x2ec5);                                                 // fall through to loc_2ec5 (rts)
}

// Second entry at 0x2e9d (loc_2e8c's `bne $2e9d`): the caller steps m.pc here so the gate dispatches.
export function loc_2e9d(m) { return loc_2e94(m); }
