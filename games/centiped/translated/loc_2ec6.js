// SPDX-License-Identifier: GPL-3.0-only
// loc_2ec6  (ROM 0x2ec6-0x2f4f) -- head-segment step: range gates on $72/$73 coords + $43,
// advances $72/$8b/$8d, writes ($32),Y via 0x2db6/0x2b91, tail-jumps the mover spine (0x3046/0x3049)
// or falls into loc_2f4f (0x2f4f); an interior dispatch modelled as a labelled block switch.
export function loc_2ec6(m) {
  const { regs, mem } = m;
  let label = 0x2ec6;
  for (;;) {
    switch (label) {
      case 0x2ec6: {
        regs.a = mem.read8(0x0072); regs.setNZ(regs.a); m.step(0x2ec8, 3);            // 2ec6 lda $72
        regs.y = mem.read8(0x00ef); regs.setNZ(regs.y); m.step(0x2eca, 3);            // 2ec8 ldy $ef
        if (regs.fZ) { m.step(0x2ed1, 3); label = 0x2ed1; continue; }                 // 2eca beq $2ed1
        m.step(0x2ecc, 2);
        regs.clc(); m.step(0x2ecd, 2);
        regs.adc(0x07); m.step(0x2ecf, 2);
        regs.eor(0xff); m.step(0x2ed1, 2);                                            // 2ecf eor #$ff
        label = 0x2ed1; continue;
      }
      case 0x2ed1: {
        regs.cmp(0xf3); m.step(0x2ed3, 2);                                            // 2ed1 cmp #$f3
        if (regs.fC) { m.step(0x2f4a, 4); label = 0x2f4a; continue; }                 // 2ed3 bcs $2f4a
        m.step(0x2ed5, 2);
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x2ed7, 2);                         // 2ed5 lda #$04
        regs.eor(mem.read8(0x00f0)); m.step(0x2ed9, 3);                               // 2ed7 eor $f0
        regs.clc(); m.step(0x2eda, 2);
        regs.adc(mem.read8(0x0073)); m.step(0x2edc, 3);                               // 2eda adc $73
        regs.cmp(mem.read8(0x0072)); m.step(0x2ede, 3);                               // 2edc cmp $72
        if (regs.fNZ) { m.step(0x2f05, 4); label = 0x2f05; continue; }                // 2ede bne $2f05
        m.step(0x2ee0, 2);
        regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2ee2, 3);            // 2ee0 lda $43
        regs.and(0xaf); m.step(0x2ee4, 2);                                            // 2ee2 and #$af
        if (regs.fNZ) { m.step(0x2efe, 3); label = 0x2efe; continue; }                // 2ee4 bne $2efe
        m.step(0x2ee6, 2);
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x2ee9, 4);            // 2ee6 lda $0c01
        regs.x = mem.read8(0x0086); regs.setNZ(regs.x); m.step(0x2eeb, 3);            // 2ee9 ldx $86
        if (regs.fPl) { m.step(0x2ef0, 3); label = 0x2ef0; continue; }                // 2eeb bpl $2ef0
        m.step(0x2eed, 2);
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x2ef0, 4);            // 2eed lda $100a
        label = 0x2ef0; continue;
      }
      case 0x2ef0: {
        regs.cpy(0xc0); m.step(0x2ef2, 2);                                            // 2ef0 cpy #$c0
        if (regs.fNZ) { m.step(0x2efa, 3); label = 0x2efa; continue; }                // 2ef2 bne $2efa
        m.step(0x2ef4, 2);
        regs.and(0x08); m.step(0x2ef6, 2);
        if (regs.fZ) { m.step(0x2f01, 4); label = 0x2f01; continue; }                 // 2ef6 beq $2f01
        m.step(0x2ef8, 2);
        if (regs.fNZ) { m.step(0x2efe, 3); label = 0x2efe; continue; }                // 2ef8 bne $2efe
        m.step(0x2efa, 2);
        label = 0x2efa; continue;
      }
      case 0x2efa: {
        regs.and(0x04); m.step(0x2efc, 2);                                            // 2efa and #$04
        if (regs.fZ) { m.step(0x2f01, 4); label = 0x2f01; continue; }                 // 2efc beq $2f01
        m.step(0x2efe, 2);
        label = 0x2efe; continue;
      }
      case 0x2efe: {
        m.step(0x3049, 3); return m.call(0x3049);                                     // 2efe jmp $3049
      }
      case 0x2f01: {
        regs.a = 0x0b; regs.setNZ(regs.a); m.step(0x2f03, 2);                         // 2f01 lda #$0b
        mem.write8(0x00b4, regs.a); m.step(0x2f05, 3);                                // 2f03 sta $b4
        label = 0x2f05; continue;
      }
      case 0x2f05: {
        regs.a = mem.read8(0x0062); regs.setNZ(regs.a); m.step(0x2f07, 3);            // 2f05 lda $62
        mem.write8(0x008b, regs.a); m.step(0x2f09, 3);                                // 2f07 sta $8b
        regs.a = 0x07; regs.setNZ(regs.a); m.step(0x2f0b, 2);                         // 2f09 lda #$07
        regs.eor(mem.read8(0x00f4)); m.step(0x2f0d, 3);                               // 2f0b eor $f4
        regs.y = mem.read8(0x0072); regs.setNZ(regs.y); m.step(0x2f0f, 3);            // 2f0d ldy $72
        regs.clc(); m.step(0x2f10, 2);
        regs.adc(mem.read8(0x0072)); m.step(0x2f12, 3);                               // 2f10 adc $72
        mem.write8(0x0072, regs.a); m.step(0x2f14, 3);                                // 2f12 sta $72
        mem.write8(0x008d, regs.y); m.step(0x2f16, 3);                                // 2f14 sty $8d
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x2f18, 2);
        regs.eor(mem.read8(0x00f3)); m.step(0x2f1a, 3);                               // 2f18 eor $f3
        regs.clc(); m.step(0x2f1b, 2);
        regs.adc(mem.read8(0x008d)); m.step(0x2f1d, 3);                               // 2f1b adc $8d
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2f1f, 2);                         // 2f1d ldy #$00
        m.push16(0x2f21); m.step(0x2f22, 6); m.call(0x2c2b);                                            // 2f1f jsr $2c2b
        if (regs.fZ) { m.step(0x2f4d, 3); label = 0x2f4d; continue; }                 // 2f22 beq $2f4d
        m.step(0x2f24, 2);
        regs.and(0x3f); m.step(0x2f26, 2);                                            // 2f24 and #$3f
        regs.cmp(0x38); m.step(0x2f28, 2);                                            // 2f26 cmp #$38
        if (regs.fNC) { m.step(0x2f4a, 3); label = 0x2f4a; continue; }                // 2f28 bcc $2f4a
        m.step(0x2f2a, 2);
        regs.sbc(0x01); m.step(0x2f2c, 2);                                            // 2f2a sbc #$01
        regs.cmp(0x3b); m.step(0x2f2e, 2);                                            // 2f2c cmp #$3b
        if (regs.fZ) { m.step(0x2f34, 3); label = 0x2f34; continue; }                 // 2f2e beq $2f34
        m.step(0x2f30, 2);
        regs.cmp(0x37); m.step(0x2f32, 2);                                            // 2f30 cmp #$37
        if (regs.fNZ) { m.step(0x2f41, 3); label = 0x2f41; continue; }                // 2f32 bne $2f41
        m.step(0x2f34, 2);
        label = 0x2f34; continue;
      }
      case 0x2f34: {
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2f36, 2);                         // 2f34 lda #$00
        mem.write8(0x008b, regs.a); m.step(0x2f38, 3);                                // 2f36 sta $8b
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x2f3a, 2);
        m.push16(0x2f3c); m.step(0x2f3d, 6); m.call(0x2db6);                                            // 2f3a jsr $2db6
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2f3f, 2);                         // 2f3d ldy #$00
        regs.a = mem.read8(0x00ef); regs.setNZ(regs.a); m.step(0x2f41, 3);            // 2f3f lda $ef
        label = 0x2f41; continue;
      }
      case 0x2f41: {
        regs.eor(mem.read8(0x00ef)); m.step(0x2f43, 3);                               // 2f41 eor $ef
        mem.write8((mem.read16(0x0032) + regs.y) & 0xffff, regs.a); m.step(0x2f45, 6); // 2f43 sta ($32),y
        if (regs.fNZ) { m.step(0x2f4a, 3); label = 0x2f4a; continue; }                // 2f45 bne $2f4a
        m.step(0x2f47, 2);
        m.push16(0x2f49); m.step(0x2f4a, 6); m.call(0x2b91);                                            // 2f47 jsr $2b91
        label = 0x2f4a; continue;
      }
      case 0x2f4a: {
        m.step(0x3046, 3); return m.call(0x3046);                                     // 2f4a jmp $3046
      }
      case 0x2f4d: {
        regs.x = 0x0d; regs.setNZ(regs.x); m.step(0x2f4f, 2);                         // 2f4d ldx #$0d (fall into loc_2f4f)
        return m.call(0x2f4f);
      }
    }
  }
}
