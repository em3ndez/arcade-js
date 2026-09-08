// SPDX-License-Identifier: GPL-3.0-only
// loc_3b04  (ROM 0x3b04-0x3c97) -- cold-boot reset: clears RAM, on the self-test switch runs the RAM/ROM
// walk and CRT sync loops, otherwise inits the display/coin regs and drops into the game via $200e.
export function loc_3b04(m) {
  const { regs, mem } = m;
  let label = 0x3b04;
  for (;;) {
    switch (label) {
      case 0x3b04: {
        regs.cld(); m.step(0x3b05, 2);                                          // 3b04 cld
        regs.x = 0xff; regs.setNZ(regs.x); m.step(0x3b07, 2);                   // 3b05 ldx #$ff
        regs.s = regs.x; m.step(0x3b08, 2);                                     // 3b07 txs
        regs.x = regs.inc8(regs.x); m.step(0x3b09, 2);                          // 3b08 inx
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3b0a, 2);                 // 3b09 txa
        label = 0x3b0a; continue;
      }
      case 0x3b0a: {
        mem.write8((0x0000 + regs.x) & 0xff, regs.a); m.step(0x3b0c, 4);        // 3b0a sta $00,x
        mem.write8((0x0100 + regs.x) & 0xffff, regs.a); m.step(0x3b0f, 5);      // 3b0c sta $0100,x
        mem.write8((0x0400 + regs.x) & 0xffff, regs.a); m.step(0x3b12, 5);      // 3b0f sta $0400,x
        mem.write8((0x0500 + regs.x) & 0xffff, regs.a); m.step(0x3b15, 5);      // 3b12 sta $0500,x
        mem.write8((0x0600 + regs.x) & 0xffff, regs.a); m.step(0x3b18, 5);      // 3b15 sta $0600,x
        mem.write8((0x0700 + regs.x) & 0xffff, regs.a); m.step(0x3b1b, 5);      // 3b18 sta $0700,x
        regs.x = regs.dec8(regs.x); m.step(0x3b1c, 2);                          // 3b1b dex
        if (regs.fNZ) {  // 3b1c bne $3b0a
          m.step(0x3b0a, 3); label = 0x3b0a; continue;
        }
        m.step(0x3b1e, 2);
        mem.write8(0x100f, regs.a); m.step(0x3b21, 4);                          // 3b1e sta $100f
        mem.write8(0x1008, regs.a); m.step(0x3b24, 4);                          // 3b21 sta $1008
        mem.write8(0x2400, regs.a); m.step(0x3b27, 4);                          // 3b24 sta $2400
        mem.write8(0x1c07, regs.a); m.step(0x3b2a, 4);                          // 3b27 sta $1c07
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3b2d, 4);      // 3b2a lda $0c00
        regs.and(0x20); m.step(0x3b2f, 2);                                      // 3b2d and #$20
        if (regs.fZ) {  // 3b2f beq $3b4a
          m.step(0x3b4a, 3); label = 0x3b4a; continue;
        }
        m.step(0x3b31, 2);
        regs.a = mem.read8(0x0800); regs.setNZ(regs.a); m.step(0x3b34, 4);      // 3b31 lda $0800
        mem.write8(0x00fd, regs.a); m.step(0x3b36, 3);                          // 3b34 sta $fd
        regs.x = regs.dec8(regs.x); m.step(0x3b37, 2);                          // 3b36 dex
        mem.write8(0x0086, regs.x); m.step(0x3b39, 3);                          // 3b37 stx $86
        mem.write8(0x00c1, regs.x); m.step(0x3b3b, 3);                          // 3b39 stx $c1
        mem.write8(0x00c2, regs.x); m.step(0x3b3d, 3);                          // 3b3b stx $c2
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x3b3f, 2);                   // 3b3d lda #$01
        mem.write8(0x00ff, regs.a); m.step(0x3b41, 3);                          // 3b3f sta $ff
        m.push16(0x3b43); m.step(0x3b44, 6); m.call(0x3a99);                                      // 3b41 jsr $3a99
        m.push16(0x3b46); m.step(0x3b47, 6); m.call(0x3a1d);                                      // 3b44 jsr $3a1d
        m.step(0x200e, 3); return m.call(0x200e);                               // 3b47 jmp $200e
      }
      case 0x3b4a: {
        mem.write8(0x1404, regs.x); m.step(0x3b4d, 4);                          // 3b4a stx $1404
        mem.write8(0x1001, regs.x); m.step(0x3b50, 4);                          // 3b4d stx $1001
        mem.write8(0x1003, regs.x); m.step(0x3b53, 4);                          // 3b50 stx $1003
        mem.write8(0x1005, regs.x); m.step(0x3b56, 4);                          // 3b53 stx $1005
        mem.write8(0x1007, regs.x); m.step(0x3b59, 4);                          // 3b56 stx $1007
        regs.x = regs.inc8(regs.x); m.step(0x3b5a, 2);                          // 3b59 inx
        mem.write8(0x1405, regs.x); m.step(0x3b5d, 4);                          // 3b5a stx $1405
        mem.write8(0x140d, regs.x); m.step(0x3b60, 4);                          // 3b5d stx $140d
        regs.x = regs.inc8(regs.x); m.step(0x3b61, 2);                          // 3b60 inx
        mem.write8(0x1406, regs.x); m.step(0x3b64, 4);                          // 3b61 stx $1406
        mem.write8(0x140e, regs.x); m.step(0x3b67, 4);                          // 3b64 stx $140e
        regs.x = regs.inc8(regs.x); m.step(0x3b68, 2);                          // 3b67 inx
        mem.write8(0x1407, regs.x); m.step(0x3b6b, 4);                          // 3b68 stx $1407
        mem.write8(0x140f, regs.x); m.step(0x3b6e, 4);                          // 3b6b stx $140f
        regs.x = 0x00; regs.setNZ(regs.x); m.step(0x3b70, 2);                   // 3b6e ldx #$00
        label = 0x3b70; continue;
      }
      case 0x3b70: {
        regs.a = mem.read8((0x0000 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x3b72, 4); // 3b70 lda $00,x
        if (regs.fNZ) {  // 3b72 bne $3bb7
          m.step(0x3bb7, 3); label = 0x3bb7; continue;
        }
        m.step(0x3b74, 2);
        regs.a = 0x11; regs.setNZ(regs.a); m.step(0x3b76, 2);                   // 3b74 lda #$11
        label = 0x3b76; continue;
      }
      case 0x3b76: {
        mem.write8((0x0000 + regs.x) & 0xff, regs.a); m.step(0x3b78, 4);        // 3b76 sta $00,x
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3b79, 2);                 // 3b78 tay
        regs.eor(mem.read8((0x0000 + regs.x) & 0xff)); m.step(0x3b7b, 4);       // 3b79 eor $00,x
        if (regs.fNZ) {  // 3b7b bne $3bb7
          m.step(0x3bb7, 3); label = 0x3bb7; continue;
        }
        m.step(0x3b7d, 2);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3b7e, 2);                 // 3b7d tya
        regs.a = regs.asl(regs.a); m.step(0x3b7f, 2);                           // 3b7e asl a
        if (regs.fNC) {  // 3b7f bcc $3b76
          m.step(0x3b76, 3); label = 0x3b76; continue;
        }
        m.step(0x3b81, 2);
        regs.x = regs.inc8(regs.x); m.step(0x3b82, 2);                          // 3b81 inx
        if (regs.fNZ) {  // 3b82 bne $3b70
          m.step(0x3b70, 3); label = 0x3b70; continue;
        }
        m.step(0x3b84, 2);
        mem.write8(0x2000, regs.a); m.step(0x3b87, 4);                          // 3b84 sta $2000
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3b88, 2);                 // 3b87 txa
        mem.write8(0x008b, regs.a); m.step(0x3b8a, 3);                          // 3b88 sta $8b
        regs.a = regs.rol(regs.a); m.step(0x3b8b, 2);                           // 3b8a rol a
        label = 0x3b8b; continue;
      }
      case 0x3b8b: {
        mem.write8(0x008c, regs.a); m.step(0x3b8d, 3);                          // 3b8b sta $8c
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3b8f, 2);                   // 3b8d ldy #$00
        label = 0x3b8f; continue;
      }
      case 0x3b8f: {
        regs.x = 0x11; regs.setNZ(regs.x); m.step(0x3b91, 2);                   // 3b8f ldx #$11
        regs.a = mem.read8((mem.read16(0x008b) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x3b93, 5 + (((mem.read16(0x008b) & 0xff00) !== ((mem.read16(0x008b) + regs.y) & 0xff00)) ? 1 : 0)); // 3b91 lda ($8b),y
        if (regs.fNZ) {  // 3b93 bne $3bbd
          m.step(0x3bbd, 3); label = 0x3bbd; continue;
        }
        m.step(0x3b95, 2);
        label = 0x3b95; continue;
      }
      case 0x3b95: {
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3b96, 2);                 // 3b95 txa
        mem.write8((mem.read16(0x008b) + regs.y) & 0xffff, regs.a); m.step(0x3b98, 6); // 3b96 sta ($8b),y
        regs.eor(mem.read8((mem.read16(0x008b) + regs.y) & 0xffff)); m.step(0x3b9a, 5 + (((mem.read16(0x008b) & 0xff00) !== ((mem.read16(0x008b) + regs.y) & 0xff00)) ? 1 : 0)); // 3b98 eor ($8b),y
        if (regs.fNZ) {  // 3b9a bne $3bbd
          m.step(0x3bbd, 3); label = 0x3bbd; continue;
        }
        m.step(0x3b9c, 2);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3b9d, 2);                 // 3b9c txa
        regs.a = regs.asl(regs.a); m.step(0x3b9e, 2);                           // 3b9d asl a
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3b9f, 2);                 // 3b9e tax
        if (regs.fNC) {  // 3b9f bcc $3b95
          m.step(0x3b95, 3); label = 0x3b95; continue;
        }
        m.step(0x3ba1, 2);
        regs.y = regs.inc8(regs.y); m.step(0x3ba2, 2);                          // 3ba1 iny
        if (regs.fNZ) {  // 3ba2 bne $3b8f
          m.step(0x3b8f, 3); label = 0x3b8f; continue;
        }
        m.step(0x3ba4, 2);
        mem.write8(0x2000, regs.a); m.step(0x3ba7, 4);                          // 3ba4 sta $2000
        mem.write8(0x008c, regs.inc8(mem.read8(0x008c))); m.step(0x3ba9, 5);    // 3ba7 inc $8c
        regs.a = mem.read8(0x008c); regs.setNZ(regs.a); m.step(0x3bab, 3);      // 3ba9 lda $8c
        regs.cmp(0x02); m.step(0x3bad, 2);                                      // 3bab cmp #$02
        if (regs.fNZ) {  // 3bad bne $3bb1
          m.step(0x3bb1, 3); label = 0x3bb1; continue;
        }
        m.step(0x3baf, 2);
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x3bb1, 2);                   // 3baf lda #$04
        label = 0x3bb1; continue;
      }
      case 0x3bb1: {
        regs.cmp(0x08); m.step(0x3bb3, 2);                                      // 3bb1 cmp #$08
        if (regs.fNC) {  // 3bb3 bcc $3b8b
          m.step(0x3b8b, 3); label = 0x3b8b; continue;
        }
        m.step(0x3bb5, 2);
        if (regs.fC) {  // 3bb5 bcs $3c16 (page-cross)
          m.step(0x3c16, 4); label = 0x3c16; continue;
        }
        m.step(0x3bb7, 2);
        label = 0x3bb7; continue;
      }
      case 0x3bb7: {
        regs.cmp(0x10); m.step(0x3bb9, 2);                                      // 3bb7 cmp #$10
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3bbb, 2);                   // 3bb9 lda #$00
        if (regs.fPl) {  // 3bbb bpl $3bcf
          m.step(0x3bcf, 3); label = 0x3bcf; continue;
        }
        m.step(0x3bbd, 2);
        label = 0x3bbd; continue;
      }
      case 0x3bbd: {
        regs.x = mem.read8(0x008c); regs.setNZ(regs.x); m.step(0x3bbf, 3);      // 3bbd ldx $8c
        regs.cpx(0x04); m.step(0x3bc1, 2);                                      // 3bbf cpx #$04
        if (regs.fNC) {  // 3bc1 bcc $3bb7
          m.step(0x3bb7, 3); label = 0x3bb7; continue;
        }
        m.step(0x3bc3, 2);
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3bc4, 2);                 // 3bc3 tax
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3bc5, 2);                 // 3bc4 tya
        regs.and(0x30); m.step(0x3bc7, 2);                                      // 3bc5 and #$30
        regs.a = regs.lsr(regs.a); m.step(0x3bc8, 2);                           // 3bc7 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3bc9, 2);                           // 3bc8 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3bca, 2);                           // 3bc9 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3bcb, 2);                           // 3bca lsr a
        regs.adc(0x01); m.step(0x3bcd, 2);                                      // 3bcb adc #$01
        regs.cpx(0x10); m.step(0x3bcf, 2);                                      // 3bcd cpx #$10
        label = 0x3bcf; continue;
      }
      case 0x3bcf: {
        regs.a = regs.rol(regs.a); m.step(0x3bd0, 2);                           // 3bcf rol a
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3bd1, 2);                 // 3bd0 tay
        regs.a = 0x40; regs.setNZ(regs.a); m.step(0x3bd3, 2);                   // 3bd1 lda #$40
        mem.write8(0x1000, regs.a); m.step(0x3bd6, 4);                          // 3bd3 sta $1000
        regs.x = 0x03; regs.setNZ(regs.x); m.step(0x3bd8, 2);                   // 3bd6 ldx #$03
        mem.write8(0x100f, regs.x); m.step(0x3bdb, 4);                          // 3bd8 stx $100f
        label = 0x3bdb; continue;
      }
      case 0x3bdb: {
        regs.x = 0x10; regs.setNZ(regs.x); m.step(0x3bdd, 2);                   // 3bdb ldx #$10
        regs.a = 0xaf; regs.setNZ(regs.a); m.step(0x3bdf, 2);                   // 3bdd lda #$af
        mem.write8(0x1001, regs.a); m.step(0x3be2, 4);                          // 3bdf sta $1001
        label = 0x3be2; continue;
      }
      case 0x3be2: {
        regs.bit(mem.read8(0x0c00)); m.step(0x3be5, 4);                         // 3be2 bit $0c00
        if (regs.fNV) {  // 3be5 bvc $3be2
          m.step(0x3be2, 3); label = 0x3be2; continue;
        }
        m.step(0x3be7, 2);
        label = 0x3be7; continue;
      }
      case 0x3be7: {
        regs.bit(mem.read8(0x0c00)); m.step(0x3bea, 4);                         // 3be7 bit $0c00
        if (regs.fV) {  // 3bea bvs $3be7
          m.step(0x3be7, 3); label = 0x3be7; continue;
        }
        m.step(0x3bec, 2);
        mem.write8(0x2000, regs.a); m.step(0x3bef, 4);                          // 3bec sta $2000
        regs.x = regs.dec8(regs.x); m.step(0x3bf0, 2);                          // 3bef dex
        if (regs.fNZ) {  // 3bf0 bne $3be2
          m.step(0x3be2, 3); label = 0x3be2; continue;
        }
        m.step(0x3bf2, 2);
        mem.write8(0x1001, regs.x); m.step(0x3bf5, 4);                          // 3bf2 stx $1001
        regs.x = 0x10; regs.setNZ(regs.x); m.step(0x3bf7, 2);                   // 3bf5 ldx #$10
        label = 0x3bf7; continue;
      }
      case 0x3bf7: {
        regs.bit(mem.read8(0x0c00)); m.step(0x3bfa, 4);                         // 3bf7 bit $0c00
        if (regs.fNV) {  // 3bfa bvc $3bf7
          m.step(0x3bf7, 3); label = 0x3bf7; continue;
        }
        m.step(0x3bfc, 2);
        label = 0x3bfc; continue;
      }
      case 0x3bfc: {
        regs.bit(mem.read8(0x0c00)); m.step(0x3bff, 4);                         // 3bfc bit $0c00
        if (regs.fV) {  // 3bff bvs $3bfc
          m.step(0x3bfc, 4); label = 0x3bfc; continue;                          // 3bff bvs $3bfc (taken: +1 page-cross)
        }
        m.step(0x3c01, 2);
        mem.write8(0x2000, regs.a); m.step(0x3c04, 4);                          // 3c01 sta $2000
        regs.x = regs.dec8(regs.x); m.step(0x3c05, 2);                          // 3c04 dex
        if (regs.fNZ) {  // 3c05 bne $3bf7 (page-cross)
          m.step(0x3bf7, 4); label = 0x3bf7; continue;
        }
        m.step(0x3c07, 2);
        regs.y = regs.dec8(regs.y); m.step(0x3c08, 2);                          // 3c07 dey
        if (regs.fPl) {  // 3c08 bpl $3bdb (page-cross)
          m.step(0x3bdb, 4); label = 0x3bdb; continue;
        }
        m.step(0x3c0a, 2);
        label = 0x3c0a; continue;
      }
      case 0x3c0a: {
        mem.write8(0x2000, regs.a); m.step(0x3c0d, 4);                          // 3c0a sta $2000
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3c10, 4);      // 3c0d lda $0c00
        regs.and(0x20); m.step(0x3c12, 2);                                      // 3c10 and #$20
        if (regs.fZ) {  // 3c12 beq $3c0a
          m.step(0x3c0a, 3); label = 0x3c0a; continue;
        }
        m.step(0x3c14, 2);
        label = 0x3c14; continue;
      }
      case 0x3c14: {
        if (regs.fNZ) {  // 3c14 bne $3c14
          m.step(0x3c14, 3); label = 0x3c14; continue;
        }
        m.step(0x3c16, 2);
        label = 0x3c16; continue;
      }
      case 0x3c16: {
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3c19, 4);      // 3c16 lda $0c01
        regs.and(0x10); m.step(0x3c1b, 2);                                      // 3c19 and #$10
        if (regs.fZ) {  // 3c1b beq $3c20
          m.step(0x3c20, 3); label = 0x3c20; continue;
        }
        m.step(0x3c1d, 2);
        m.step(0x3c97, 3); return m.call(0x3c97);                               // 3c1d jmp $3c97
      }
      case 0x3c20: {
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3c21, 2);                 // 3c20 tax
        label = 0x3c21; continue;
      }
      case 0x3c21: {
        mem.write8((0x0000 + regs.x) & 0xff, regs.a); m.step(0x3c23, 4);        // 3c21 sta $00,x
        regs.x = regs.inc8(regs.x); m.step(0x3c24, 2);                          // 3c23 inx
        if (regs.fNZ) {  // 3c24 bne $3c21
          m.step(0x3c21, 3); label = 0x3c21; continue;
        }
        m.step(0x3c26, 2);
        regs.x = 0x0f; regs.setNZ(regs.x); m.step(0x3c28, 2);                   // 3c26 ldx #$0f
        regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x3c2a, 2);                   // 3c28 lda #$f8
        label = 0x3c2a; continue;
      }
      case 0x3c2a: {
        mem.write8((0x0064 + regs.x) & 0xff, regs.a); m.step(0x3c2c, 4);        // 3c2a sta $64,x
        regs.x = regs.dec8(regs.x); m.step(0x3c2d, 2);                          // 3c2c dex
        if (regs.fPl) {  // 3c2d bpl $3c2a
          m.step(0x3c2a, 3); label = 0x3c2a; continue;
        }
        m.step(0x3c2f, 2);
        regs.a = 0x07; regs.setNZ(regs.a); m.step(0x3c31, 2);                   // 3c2f lda #$07
        mem.write8(0x008c, regs.a); m.step(0x3c33, 3);                          // 3c31 sta $8c
        regs.y = 0xbf; regs.setNZ(regs.y); m.step(0x3c35, 2);                   // 3c33 ldy #$bf
        label = 0x3c35; continue;
      }
      case 0x3c35: {
        regs.a = 0x2d; regs.setNZ(regs.a); m.step(0x3c37, 2);                   // 3c35 lda #$2d
        label = 0x3c37; continue;
      }
      case 0x3c37: {
        regs.x = 0x08; regs.setNZ(regs.x); m.step(0x3c39, 2);                   // 3c37 ldx #$08
        label = 0x3c39; continue;
      }
      case 0x3c39: {
        mem.write8((mem.read16(0x008b) + regs.y) & 0xffff, regs.a); m.step(0x3c3b, 6); // 3c39 sta ($8b),y
        regs.y = regs.dec8(regs.y); m.step(0x3c3c, 2);                          // 3c3b dey
        regs.x = regs.dec8(regs.x); m.step(0x3c3d, 2);                          // 3c3c dex
        if (regs.fNZ) {  // 3c3d bne $3c39
          m.step(0x3c39, 3); label = 0x3c39; continue;
        }
        m.step(0x3c3f, 2);
        regs.sec(); m.step(0x3c40, 2);                                          // 3c3f sec
        regs.sbc(0x01); m.step(0x3c42, 2);                                      // 3c40 sbc #$01
        regs.cmp(0x2a); m.step(0x3c44, 2);                                      // 3c42 cmp #$2a
        if (regs.fC) {  // 3c44 bcs $3c37
          m.step(0x3c37, 3); label = 0x3c37; continue;
        }
        m.step(0x3c46, 2);
        regs.cpy(0xff); m.step(0x3c48, 2);                                      // 3c46 cpy #$ff
        if (regs.fNZ) {  // 3c48 bne $3c35
          m.step(0x3c35, 3); label = 0x3c35; continue;
        }
        m.step(0x3c4a, 2);
        mem.write8(0x008c, regs.dec8(mem.read8(0x008c))); m.step(0x3c4c, 5);    // 3c4a dec $8c
        regs.a = mem.read8(0x008c); regs.setNZ(regs.a); m.step(0x3c4e, 3);      // 3c4c lda $8c
        regs.cmp(0x04); m.step(0x3c50, 2);                                      // 3c4e cmp #$04
        if (regs.fC) {  // 3c50 bcs $3c35
          m.step(0x3c35, 3); label = 0x3c35; continue;
        }
        m.step(0x3c52, 2);
        regs.cli(); m.step(0x3c53, 2);                                          // 3c52 cli
        label = 0x3c53; continue;
      }
      case 0x3c53: {
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3c56, 4);      // 3c53 lda $0c00
        regs.and(0x20); m.step(0x3c58, 2);                                      // 3c56 and #$20
        if (regs.fNZ) {  // 3c58 bne $3c53
          m.step(0x3c53, 3); label = 0x3c53; continue;
        }
        m.step(0x3c5a, 2);
        mem.write8(0x008a, regs.lsr(mem.read8(0x008a))); m.step(0x3c5c, 5);     // 3c5a lsr $8a
        mem.write8(0x2000, regs.a); m.step(0x3c5f, 4);                          // 3c5c sta $2000
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3c62, 4);      // 3c5f lda $0c01
        regs.and(0xe0); m.step(0x3c64, 2);                                      // 3c62 and #$e0
        regs.eor(0xe0); m.step(0x3c66, 2);                                      // 3c64 eor #$e0
        if (regs.fZ) {  // 3c66 beq $3c53
          m.step(0x3c53, 3); label = 0x3c53; continue;
        }
        m.step(0x3c68, 2);
        regs.a = 0x1d; regs.setNZ(regs.a); m.step(0x3c6a, 2);                   // 3c68 lda #$1d
        regs.sei(); m.step(0x3c6b, 2);                                          // 3c6a sei
        label = 0x3c6b; continue;
      }
      case 0x3c6b: {
        mem.write8((0x0400 + regs.x) & 0xffff, regs.a); m.step(0x3c6e, 5);      // 3c6b sta $0400,x
        mem.write8((0x0500 + regs.x) & 0xffff, regs.a); m.step(0x3c71, 5);      // 3c6e sta $0500,x
        mem.write8((0x0600 + regs.x) & 0xffff, regs.a); m.step(0x3c74, 5);      // 3c71 sta $0600,x
        regs.x = regs.inc8(regs.x); m.step(0x3c75, 2);                          // 3c74 inx
        if (regs.fNZ) {  // 3c75 bne $3c6b
          m.step(0x3c6b, 3); label = 0x3c6b; continue;
        }
        m.step(0x3c77, 2);
        label = 0x3c77; continue;
      }
      case 0x3c77: {
        mem.write8((0x0700 + regs.x) & 0xffff, regs.a); m.step(0x3c7a, 5);      // 3c77 sta $0700,x
        regs.x = regs.inc8(regs.x); m.step(0x3c7b, 2);                          // 3c7a inx
        regs.cpx(0xc0); m.step(0x3c7d, 2);                                      // 3c7b cpx #$c0
        if (regs.fNC) {  // 3c7d bcc $3c77
          m.step(0x3c77, 3); label = 0x3c77; continue;
        }
        m.step(0x3c7f, 2);
        regs.x = 0x08; regs.setNZ(regs.x); m.step(0x3c81, 2);                   // 3c7f ldx #$08
        mem.write8(0x1405, regs.x); m.step(0x3c84, 4);                          // 3c81 stx $1405
        regs.x = 0x0f; regs.setNZ(regs.x); m.step(0x3c86, 2);                   // 3c84 ldx #$0f
        mem.write8(0x1404, regs.x); m.step(0x3c89, 4);                          // 3c86 stx $1404
        label = 0x3c89; continue;
      }
      case 0x3c89: {
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3c8c, 4);      // 3c89 lda $0c00
        regs.and(0x20); m.step(0x3c8e, 2);                                      // 3c8c and #$20
        if (regs.fNZ) {  // 3c8e bne $3c89
          m.step(0x3c89, 3); label = 0x3c89; continue;
        }
        m.step(0x3c90, 2);
        mem.write8(0x2000, regs.a); m.step(0x3c93, 4);                          // 3c90 sta $2000
        mem.write8(0x008a, regs.lsr(mem.read8(0x008a))); m.step(0x3c95, 5);     // 3c93 lsr $8a
        if (regs.fPl) {  // 3c95 bpl $3c89
          m.step(0x3c89, 3); label = 0x3c89; continue;
        }
        m.step(0x3c97, 2);
        return m.call(0x3c97);                                                  // fall into loc_3c97
      }
    }
  }
}
