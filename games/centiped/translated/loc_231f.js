// SPDX-License-Identifier: GPL-3.0-only
// loc_231f  (ROM 0x231f-0x23d9) -- rebuilds a centipede segment's 12-entry sprite tables ($34/$44/
// $54/$64/$74,X) from $9a/$9c/$ab counters, mirroring X via loc_382d; two X-indexed loops, RTS.
export function loc_231f(m) {
  const { regs, mem } = m;
  let block = 0x231f;
  for (;;) {
    switch (block) {
      case 0x231f: {
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2321, 3);              // 231f ldx $88
        regs.a = mem.read8((0x0094 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2323, 4); // 2321 lda $94,x
        if (regs.fNZ) { m.step(0x2345, 3); block = 0x2345; break; }                     // 2323 bne $2345
        m.step(0x2325, 2); block = 0x2325; break;
      }
      case 0x2325: {
        regs.a = mem.read8((0x00c2 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2327, 4); // 2325 lda $c2,x
        regs.ora(0x80); m.step(0x2329, 2);                                              // 2327 ora #$80
        mem.write8((0x00c2 + regs.x) & 0xff, regs.a); m.step(0x232b, 4);                // 2329 sta $c2,x
        regs.a = mem.read8((0x009c + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x232d, 4); // 232b lda $9c,x
        regs.cmp(0x03); m.step(0x232f, 2);                                              // 232d cmp #$03
        if (regs.fNC) { m.step(0x2345, 3); block = 0x2345; break; }                     // 232f bcc $2345
        m.step(0x2331, 2); block = 0x2331; break;
      }
      case 0x2331: {
        mem.write8((0x009a + regs.x) & 0xff, regs.dec8(mem.read8((0x009a + regs.x) & 0xff))); m.step(0x2333, 6); // 2331 dec $9a,x
        if (regs.fNZ) { m.step(0x2339, 3); block = 0x2339; break; }                     // 2333 bne $2339
        m.step(0x2335, 2); block = 0x2335; break;
      }
      case 0x2335: {
        regs.a = 0x0c; regs.setNZ(regs.a); m.step(0x2337, 2);
        mem.write8((0x009a + regs.x) & 0xff, regs.a); m.step(0x2339, 4);                // 2337 sta $9a,x
        block = 0x2339; break;
      }
      case 0x2339: {
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x233b, 2);                           // 2339 lda #$02
        regs.y = mem.read8((0x00ab + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x233d, 4); // 233b ldy $ab,x
        regs.cpy(0x04); m.step(0x233f, 2);                                              // 233d cpy #$04
        if (regs.fC) { m.step(0x2343, 3); block = 0x2343; break; }                      // 233f bcs $2343
        m.step(0x2341, 2); block = 0x2341; break;
      }
      case 0x2341: {
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x2343, 2);
        block = 0x2343; break;
      }
      case 0x2343: {
        mem.write8((0x009c + regs.x) & 0xff, regs.a); m.step(0x2345, 4);                // 2343 sta $9c,x
        block = 0x2345; break;
      }
      case 0x2345: {
        regs.a = 0x03; regs.setNZ(regs.a); m.step(0x2347, 2);
        mem.write8(0x0034, regs.a); m.step(0x2349, 3);
        regs.a = mem.read8((0x009c + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x234b, 4);
        mem.write8(0x0074, regs.a); m.step(0x234d, 3);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x234e, 2);                         // 234d tay
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2350, 3);              // 234e lda $00
        regs.and(0x02); m.step(0x2352, 2);                                              // 2350 and #$02
        if (regs.fNZ) { m.step(0x2359, 3); block = 0x2359; break; }                     // 2352 bne $2359
        m.step(0x2354, 2); block = 0x2354; break;
      }
      case 0x2354: {
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2355, 2);                         // 2354 tya
        m.push16(0x2357); m.step(0x2358, 6); m.call(0x382d);                                              // 2355 jsr $382d
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x2359, 2);                         // 2358 tay
        block = 0x2359; break;
      }
      case 0x2359: {
        mem.write8(0x0044, regs.y); m.step(0x235b, 3);                                  // 2359 sty $44
        regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x235d, 2);                           // 235b lda #$f8
        regs.eor(mem.read8(0x00f0)); m.step(0x235f, 3);                                 // 235d eor $f0
        mem.write8(0x0064, regs.a); m.step(0x2361, 3);                                  // 235f sta $64
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x2363, 2);                           // 2361 lda #$80
        mem.write8(0x0054, regs.a); m.step(0x2365, 3);                                  // 2363 sta $54
        regs.a = mem.read8((0x009a + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2367, 4); // 2365 lda $9a,x
        mem.write8(0x008b, regs.a); m.step(0x2369, 3);                                  // 2367 sta $8b
        regs.cmp(0x01); m.step(0x236b, 2);                                              // 2369 cmp #$01
        if (regs.fZ) { m.step(0x23a2, 3); block = 0x23a2; break; }                      // 236b beq $23a2
        m.step(0x236d, 2); block = 0x236d; break;
      }
      case 0x236d: {
        regs.y = 0x42; regs.setNZ(regs.y); m.step(0x236f, 2);                           // 236d ldy #$42
        regs.x = 0x01; regs.setNZ(regs.x); m.step(0x2371, 2);                           // 236f ldx #$01
        block = 0x2371; break;
      }
      case 0x2371: {
        mem.write8((0x0034 + regs.x) & 0xff, regs.y); m.step(0x2373, 4);                // 2371 sty $34,x
        regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x2375, 2);                           // 2373 lda #$f8
        regs.eor(mem.read8(0x00f0)); m.step(0x2377, 3);                                 // 2375 eor $f0
        mem.write8((0x0064 + regs.x) & 0xff, regs.a); m.step(0x2379, 4);                // 2377 sta $64,x
        regs.a = mem.read8((0x0073 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x237b, 4); // 2379 lda $73,x
        mem.write8((0x0074 + regs.x) & 0xff, regs.a); m.step(0x237d, 4);                // 237b sta $74,x
        regs.a = mem.read8((0x0043 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x237f, 4); // 237d lda $43,x
        mem.write8((0x0044 + regs.x) & 0xff, regs.a); m.step(0x2381, 4);                // 237f sta $44,x
        if (regs.fPl) { m.step(0x2387, 3); block = 0x2387; break; }                     // 2381 bpl $2387
        m.step(0x2383, 2); block = 0x2383; break;
      }
      case 0x2383: {
        regs.a = 0x08; regs.setNZ(regs.a); m.step(0x2385, 2);                           // 2383 lda #$08
        if (regs.fNZ) { m.step(0x2389, 3); block = 0x2389; break; }                     // 2385 bne $2389
        m.step(0x2387, 2); block = 0x2387; break;
      }
      case 0x2387: {
        regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x2389, 2);                           // 2387 lda #$f8
        block = 0x2389; break;
      }
      case 0x2389: {
        regs.clc(); m.step(0x238a, 2);                                                  // 2389 clc
        regs.adc(mem.read8((0x0053 + regs.x) & 0xff)); m.step(0x238c, 4);               // 238a adc $53,x
        mem.write8((0x0054 + regs.x) & 0xff, regs.a); m.step(0x238e, 4);                // 238c sta $54,x
        regs.y = regs.dec8(regs.y); m.step(0x238f, 2);                                  // 238e dey
        regs.cpy(0x3f); m.step(0x2391, 2);                                              // 238f cpy #$3f
        if (regs.fNZ) { m.step(0x2395, 3); block = 0x2395; break; }                     // 2391 bne $2395
        m.step(0x2393, 2); block = 0x2393; break;
      }
      case 0x2393: {
        regs.y = 0x47; regs.setNZ(regs.y); m.step(0x2395, 2);                           // 2393 ldy #$47
        block = 0x2395; break;
      }
      case 0x2395: {
        regs.x = regs.inc8(regs.x); m.step(0x2396, 2);                                  // 2395 inx
        regs.cpx(mem.read8(0x008b)); m.step(0x2398, 3);                                 // 2396 cpx $8b
        if (regs.fNC) { m.step(0x2371, 3); block = 0x2371; break; }                     // 2398 bcc $2371
        m.step(0x239a, 2); block = 0x239a; break;
      }
      case 0x239a: {
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x239c, 3);              // 239a ldx $88
        regs.a = mem.read8((0x009a + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x239e, 4); // 239c lda $9a,x
        regs.cmp(0x0c); m.step(0x23a0, 2);                                              // 239e cmp #$0c
        if (regs.fZ) { m.step(0x23cf, 3); block = 0x23cf; break; }                      // 23a0 beq $23cf
        m.step(0x23a2, 2); block = 0x23a2; break;
      }
      case 0x23a2: {
        regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x23a4, 2);                           // 23a2 lda #$f8
        regs.eor(mem.read8(0x00f0)); m.step(0x23a6, 3);                                 // 23a4 eor $f0
        regs.x = mem.read8(0x008b); regs.setNZ(regs.x); m.step(0x23a8, 3);              // 23a6 ldx $8b
        block = 0x23a8; break;
      }
      case 0x23a8: {
        mem.write8((0x0064 + regs.x) & 0xff, regs.a); m.step(0x23aa, 4);                // 23a8 sta $64,x
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x23ac, 2);                           // 23aa lda #$00
        mem.write8((0x0034 + regs.x) & 0xff, regs.a); m.step(0x23ae, 4);                // 23ac sta $34,x
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x23b0, 2);                           // 23ae lda #$02
        regs.y = mem.read8(0x00f4); regs.setNZ(regs.y); m.step(0x23b2, 3);              // 23b0 ldy $f4
        if (regs.fZ) { m.step(0x23b5, 3); block = 0x23b5; break; }                      // 23b2 beq $23b5
        m.step(0x23b4, 2); block = 0x23b4; break;
      }
      case 0x23b4: {
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x23b5, 2);                         // 23b4 tya
        block = 0x23b5; break;
      }
      case 0x23b5: {
        mem.write8((0x0074 + regs.x) & 0xff, regs.a); m.step(0x23b7, 4);                // 23b5 sta $74,x
        regs.bit(mem.read8(0x100a)); m.step(0x23ba, 4);                                 // 23b7 bit $100a
        if (regs.fPl) { m.step(0x23bf, 3); block = 0x23bf; break; }                     // 23ba bpl $23bf
        m.step(0x23bc, 2); block = 0x23bc; break;
      }
      case 0x23bc: {
        m.push16(0x23be); m.step(0x23bf, 6); m.call(0x382d);                                              // 23bc jsr $382d
        block = 0x23bf; break;
      }
      case 0x23bf: {
        mem.write8((0x0044 + regs.x) & 0xff, regs.a); m.step(0x23c1, 4);                // 23bf sta $44,x
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x23c4, 4);              // 23c1 lda $100a
        regs.and(0xf8); m.step(0x23c6, 2);                                              // 23c4 and #$f8
        mem.write8((0x0054 + regs.x) & 0xff, regs.a); m.step(0x23c8, 4);                // 23c6 sta $54,x
        regs.a = mem.read8((0x0064 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x23ca, 4); // 23c8 lda $64,x
        regs.x = regs.inc8(regs.x); m.step(0x23cb, 2);                                  // 23ca inx
        regs.cpx(0x0c); m.step(0x23cd, 2);                                              // 23cb cpx #$0c
        if (regs.fNC) { m.step(0x23a8, 3); block = 0x23a8; break; }                     // 23cd bcc $23a8
        m.step(0x23cf, 2); block = 0x23cf; break;
      }
      case 0x23cf: {
        regs.a = 0x0c; regs.setNZ(regs.a); m.step(0x23d1, 2);                           // 23cf lda #$0c
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x23d3, 3);              // 23d1 ldx $88
        mem.write8((0x0094 + regs.x) & 0xff, regs.a); m.step(0x23d5, 4);                // 23d3 sta $94,x
        regs.a = mem.read8(0x00fe); regs.setNZ(regs.a); m.step(0x23d7, 3);              // 23d5 lda $fe
        mem.write8(0x0097, regs.a); m.step(0x23d9, 3);                                  // 23d7 sta $97
        return m.ret(6);                                                                // 23d9 rts
      }
    }
  }
}
