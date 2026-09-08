// SPDX-License-Identifier: GPL-3.0-only
// loc_3c97 (ROM 0x3c97-0x3d56) -- cold init: zeroes zp $00 + pages $0400/$0500/$0600 and fills $0700
// with X, seeds $54,x/$64,x to $80|x, runs the $2000 bank checksums into pushed bytes, plots them via
// $3836/$384f, calls loc_3a99, copies $018b.. to $8e.., does a BCD adjust, then falls into loc_3d57.
export function loc_3c97(m) {
  const { regs, mem } = m;
  let label = 0x3c97;
  for (;;) {
    switch (label) {
      case 0x3c97: {
        regs.x = 0x00; regs.setNZ(regs.x); m.step(0x3c99, 2);                     // 3c97 ldx #$00
        label = 0x3c99; continue;
      }
      case 0x3c99: {
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3c9a, 2);                   // 3c99 txa
        mem.write8((0x0700 + regs.x) & 0xffff, regs.a); m.step(0x3c9d, 5);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3c9f, 2);                     // 3c9d lda #$00
        mem.write8((0x00 + regs.x) & 0xff, regs.a); m.step(0x3ca1, 4);
        mem.write8((0x0400 + regs.x) & 0xffff, regs.a); m.step(0x3ca4, 5);
        mem.write8((0x0500 + regs.x) & 0xffff, regs.a); m.step(0x3ca7, 5);
        mem.write8((0x0600 + regs.x) & 0xffff, regs.a); m.step(0x3caa, 5);
        regs.x = regs.inc8(regs.x); m.step(0x3cab, 2);                            // 3caa inx
        if (regs.fNZ) { m.step(0x3c99, 3); label = 0x3c99; continue; }            // 3cab bne $3c99
        m.step(0x3cad, 2);
        regs.x = regs.dec8(regs.x); m.step(0x3cae, 2);                            // 3cad dex
        mem.write8(0x00d5, regs.x); m.step(0x3cb0, 3);
        mem.write8(0x00e3, regs.x); m.step(0x3cb2, 3);
        mem.write8(0x1c03, regs.a); m.step(0x3cb5, 4);
        mem.write8(0x1c04, regs.a); m.step(0x3cb8, 4);
        regs.x = 0x0f; regs.setNZ(regs.x); m.step(0x3cba, 2);                     // 3cb8 ldx #$0f
        label = 0x3cba; continue;
      }
      case 0x3cba: {
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3cbb, 2);                   // 3cba txa
        regs.ora(0x80); m.step(0x3cbd, 2);                                        // 3cbb ora #$80
        mem.write8((0x54 + regs.x) & 0xff, regs.a); m.step(0x3cbf, 4);
        mem.write8((0x64 + regs.x) & 0xff, regs.a); m.step(0x3cc1, 4);
        regs.x = regs.dec8(regs.x); m.step(0x3cc2, 2);                            // 3cc1 dex
        if (regs.fPl) { m.step(0x3cba, 3); label = 0x3cba; continue; }            // 3cc2 bpl $3cba
        m.step(0x3cc4, 2);
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x3cc7, 4);        // 3cc4 lda $100a
        regs.eor(mem.read8(0x100a)); m.step(0x3cca, 4);                           // 3cc7 eor $100a
        mem.write8(0x00e5, regs.a); m.step(0x3ccc, 3);
        regs.a = 0x03; regs.setNZ(regs.a); m.step(0x3cce, 2);                     // 3ccc lda #$03
        mem.write8(0x100f, regs.a); m.step(0x3cd1, 4);
        regs.x = 0x00; regs.setNZ(regs.x); m.step(0x3cd3, 2);                     // 3cd1 ldx #$00
        mem.write8(0x008b, regs.x); m.step(0x3cd5, 3);
        regs.a = 0x20; regs.setNZ(regs.a); m.step(0x3cd7, 2);                     // 3cd5 lda #$20
        mem.write8(0x008c, regs.a); m.step(0x3cd9, 3);
        regs.x = 0x1f; regs.setNZ(regs.x); m.step(0x3cdb, 2);                     // 3cd9 ldx #$1f
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x3cdd, 2);                     // 3cdb lda #$ff
        label = 0x3cdd; continue;
      }
      case 0x3cdd: {
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3cdf, 2);                     // 3cdd ldy #$00
        mem.write8(0x2000, regs.x); m.step(0x3ce2, 4);
        label = 0x3ce2; continue;
      }
      case 0x3ce2: {
        const base = mem.read16(0x008b); const addr = (base + regs.y) & 0xffff;
        regs.eor(mem.read8(addr));
        m.step(0x3ce4, (base & 0xff00) !== (addr & 0xff00) ? 6 : 5);              // 3ce2 eor ($8b),y
        regs.y = regs.inc8(regs.y); m.step(0x3ce5, 2);                            // 3ce4 iny
        if (regs.fNZ) { m.step(0x3ce2, 3); label = 0x3ce2; continue; }            // 3ce5 bne $3ce2
        m.step(0x3ce7, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3ce8, 2);                   // 3ce7 tay
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3ce9, 2);                   // 3ce8 txa
        regs.and(0x07); m.step(0x3ceb, 2);                                        // 3ce9 and #$07
        regs.cmp(0x01); m.step(0x3ced, 2);                                        // 3ceb cmp #$01
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3cee, 2);                   // 3ced tya
        if (regs.fC) { m.step(0x3cf3, 3); label = 0x3cf3; continue; }             // 3cee bcs $3cf3
        m.step(0x3cf0, 2);
        m.push8(regs.a); m.step(0x3cf1, 3);                                       // 3cf0 pha
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x3cf3, 2);                     // 3cf1 lda #$ff
        label = 0x3cf3; continue;
      }
      case 0x3cf3: {
        mem.write8(0x008c, regs.inc8(mem.read8(0x008c))); m.step(0x3cf5, 5);      // 3cf3 inc $8c
        regs.x = regs.dec8(regs.x); m.step(0x3cf6, 2);                            // 3cf5 dex
        if (regs.fPl) { m.step(0x3cdd, 3); label = 0x3cdd; continue; }            // 3cf6 bpl $3cdd
        m.step(0x3cf8, 2);
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x3cfa, 2);                     // 3cf8 lda #$04
        mem.write8(0x0092, regs.a); m.step(0x3cfc, 3);
        regs.x = 0x03; regs.setNZ(regs.x); m.step(0x3cfe, 2);                     // 3cfc ldx #$03
        label = 0x3cfe; continue;
      }
      case 0x3cfe: {
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3cff, 2);                   // 3cfe txa
        regs.eor(0x3f); m.step(0x3d01, 2);                                        // 3cff eor #$3f
        mem.write8(0x0091, regs.a); m.step(0x3d03, 3);
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x3d04, 4);                // 3d03 pla
        if (regs.fZ) { m.step(0x3d17, 3); label = 0x3d17; continue; }             // 3d04 beq $3d17
        m.step(0x3d06, 2);
        m.push8(regs.a); m.step(0x3d07, 3);                                       // 3d06 pha
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3d08, 2);                   // 3d07 txa
        regs.ora(0x20); m.step(0x3d0a, 2);                                        // 3d08 ora #$20
        m.push16(0x3d0c); m.step(0x3d0d, 6); m.call(0x3836);                                        // 3d0a jsr $3836
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3d0f, 2);                     // 3d0d lda #$00
        m.push16(0x3d11); m.step(0x3d12, 6); m.call(0x3836);                                        // 3d0f jsr $3836
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x3d13, 4);                // 3d12 pla
        regs.clc(); m.step(0x3d14, 2);                                            // 3d13 clc
        m.push16(0x3d16); m.step(0x3d17, 6); m.call(0x384f);                                        // 3d14 jsr $384f
        label = 0x3d17; continue;
      }
      case 0x3d17: {
        regs.x = regs.dec8(regs.x); m.step(0x3d18, 2);                            // 3d17 dex
        if (regs.fPl) { m.step(0x3cfe, 4); label = 0x3cfe; continue; }            // 3d18 bpl $3cfe
        m.step(0x3d1a, 2);
        m.push16(0x3d1c); m.step(0x3d1d, 6); m.call(0x3a99);                                        // 3d1a jsr $3a99
        regs.y = 0x06; regs.setNZ(regs.y); m.step(0x3d1f, 2);                     // 3d1d ldy #$06
        label = 0x3d1f; continue;
      }
      case 0x3d1f: {
        const base = 0x018b; const addr = (base + regs.y) & 0xffff;
        regs.a = mem.read8(addr); regs.setNZ(regs.a);
        m.step(0x3d22, (base & 0xff00) !== (addr & 0xff00) ? 5 : 4);              // 3d1f lda $018b,y
        mem.write8((0x008e + regs.y) & 0xffff, regs.a); m.step(0x3d25, 5);
        regs.y = regs.dec8(regs.y); m.step(0x3d26, 2);                            // 3d25 dey
        if (regs.fPl) { m.step(0x3d1f, 3); label = 0x3d1f; continue; }            // 3d26 bpl $3d1f
        m.step(0x3d28, 2);
        regs.sed(); m.step(0x3d29, 2);                                            // 3d28 sed
        regs.a = mem.read8(0x018b); regs.setNZ(regs.a); m.step(0x3d2c, 4);        // 3d29 lda $018b
        regs.ora(mem.read8(0x018c)); m.step(0x3d2f, 4);                           // 3d2c ora $018c
        regs.ora(mem.read8(0x018d)); m.step(0x3d32, 4);                           // 3d2f ora $018d
        if (regs.fZ) { m.step(0x3d53, 3); label = 0x3d53; continue; }             // 3d32 beq $3d53
        m.step(0x3d34, 2);
        regs.y = regs.inc8(regs.y); m.step(0x3d35, 2);                            // 3d34 iny
        label = 0x3d35; continue;
      }
      case 0x3d35: {
        regs.y = regs.inc8(regs.y); m.step(0x3d36, 2);                            // 3d35 iny
        if (regs.fZ) { m.step(0x3d53, 3); label = 0x3d53; continue; }             // 3d36 beq $3d53
        m.step(0x3d38, 2);
        regs.a = mem.read8(0x0091); regs.setNZ(regs.a); m.step(0x3d3a, 3);        // 3d38 lda $91
        regs.sec(); m.step(0x3d3b, 2);                                            // 3d3a sec
        regs.sbc(mem.read8(0x008e)); m.step(0x3d3d, 3);                           // 3d3b sbc $8e
        mem.write8(0x0091, regs.a); m.step(0x3d3f, 3);
        regs.a = mem.read8(0x0092); regs.setNZ(regs.a); m.step(0x3d41, 3);        // 3d3f lda $92
        regs.sbc(mem.read8(0x008f)); m.step(0x3d43, 3);                           // 3d41 sbc $8f
        mem.write8(0x0092, regs.a); m.step(0x3d45, 3);
        regs.a = mem.read8(0x0093); regs.setNZ(regs.a); m.step(0x3d47, 3);        // 3d45 lda $93
        regs.sbc(mem.read8(0x0090)); m.step(0x3d49, 3);                           // 3d47 sbc $90
        mem.write8(0x0093, regs.a); m.step(0x3d4b, 3);
        regs.a = mem.read8(0x0094); regs.setNZ(regs.a); m.step(0x3d4d, 3);        // 3d4b lda $94
        regs.sbc(0x00); m.step(0x3d4f, 2);                                        // 3d4d sbc #$00
        mem.write8(0x0094, regs.a); m.step(0x3d51, 3);
        if (regs.fPl) { m.step(0x3d35, 3); label = 0x3d35; continue; }            // 3d51 bpl $3d35
        m.step(0x3d53, 2);
        label = 0x3d53; continue;
      }
      case 0x3d53: {
        regs.cld(); m.step(0x3d54, 2);                                            // 3d53 cld
        mem.write8(0x008d, regs.y); m.step(0x3d56, 3);
        regs.cli(); m.step(0x3d57, 2);                                            // 3d56 cli
        return m.call(0x3d57);                                                    // fall-through into loc_3d57
      }
    }
  }
}
