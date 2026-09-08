// SPDX-License-Identifier: GPL-3.0-only
// loc_2ba8 (ROM 0x2ba8-0x2bd8) -- when the $32 cell of the pointed row is empty, classifies the low-5-bit
// column code and, for a bumpable class, bumps $d7,X then writes $3f^$ef back through ($32).
export function loc_2ba8(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2baa, 2);                                              // 2ba8 ldy #$00
  regs.a = mem.read8((mem.read16(0x0032) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x2bac, 5); // 2baa lda ($32),y
  if (regs.fNZ) { m.step(0x2bd8, 3); return m.ret(6); }                                              // 2bac bne $2bd8
  m.step(0x2bae, 2);
  regs.a = mem.read8(0x0032); regs.setNZ(regs.a); m.step(0x2bb0, 3);                                 // 2bae lda $32
  regs.and(0x1f); m.step(0x2bb2, 2);                                                                 // 2bb0 and #$1f
  if (regs.fZ) { m.step(0x2bd8, 3); return m.ret(6); }                                               // 2bb2 beq $2bd8
  m.step(0x2bb4, 2);
  regs.cmp(0x1f); m.step(0x2bb6, 2);                                                                 // 2bb4 cmp #$1f
  if (regs.fZ) { m.step(0x2bd8, 3); return m.ret(6); }                                               // 2bb6 beq $2bd8
  m.step(0x2bb8, 2);
  regs.x = mem.read8(0x00ef); regs.setNZ(regs.x); m.step(0x2bba, 3);                                 // 2bb8 ldx $ef

  let target;                        // "2bce" (bump then write) or "2bd2" (write only)
  let run2bc6 = false;               // enter the $01/$0c classifier block
  if (regs.fZ) { m.step(0x2bc6, 3); run2bc6 = true; }                                                // 2bba beq $2bc6
  else {
    m.step(0x2bbc, 2);
    regs.cmp(0x1e); m.step(0x2bbe, 2);                                                               // 2bbc cmp #$1e
    if (regs.fZ) { m.step(0x2bd8, 3); return m.ret(6); }                                             // 2bbe beq $2bd8
    m.step(0x2bc0, 2);
    regs.cmp(0x14); m.step(0x2bc2, 2);                                                               // 2bc0 cmp #$14
    if (regs.fNC) { m.step(0x2bd2, 3); target = "2bd2"; }                                            // 2bc2 bcc $2bd2
    else {
      m.step(0x2bc4, 2);
      if (regs.fC) { m.step(0x2bce, 3); target = "2bce"; }                                           // 2bc4 bcs $2bce
      else { m.step(0x2bc6, 2); run2bc6 = true; }
    }
  }
  if (run2bc6) {
    regs.cmp(0x01); m.step(0x2bc8, 2);                                                               // 2bc6 cmp #$01
    if (regs.fZ) { m.step(0x2bd8, 3); return m.ret(6); }                                             // 2bc8 beq $2bd8
    m.step(0x2bca, 2);
    regs.cmp(0x0c); m.step(0x2bcc, 2);                                                               // 2bca cmp #$0c
    if (regs.fC) { m.step(0x2bd2, 3); target = "2bd2"; }                                             // 2bcc bcs $2bd2
    else { m.step(0x2bce, 2); target = "2bce"; }
  }
  if (target === "2bce") {
    regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2bd0, 3);                               // 2bce ldx $88
    { const a = (0x00d7 + regs.x) & 0xff; mem.write8(a, regs.inc8(mem.read8(a))); } m.step(0x2bd2, 6); // 2bd0 inc $d7,x
  }
  regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x2bd4, 2);                                              // 2bd2 lda #$3f
  regs.eor(mem.read8(0x00ef)); m.step(0x2bd6, 3);                                                    // 2bd4 eor $ef
  mem.write8((mem.read16(0x0032) + regs.y) & 0xffff, regs.a); m.step(0x2bd8, 6);                     // 2bd6 sta ($32),y
  return m.ret(6);                                                                                   // 2bd8 rts
}
