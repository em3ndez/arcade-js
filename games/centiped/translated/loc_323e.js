// SPDX-License-Identifier: GPL-3.0-only
// loc_323e  (ROM 0x323e-0x32fe) -- decimal-adds $fb/$89 rates into the $018b/$018e counters, then scans
// the 8-slot $0002 table (Y) against each object X ($a8/$aa/$ac) for a 24-bit range match, compacting on hit.
export function loc_323e(m) {
  const { regs, mem } = m;
  let label = 0x323e;
  for (;;) {
    switch (label) {
      case 0x323e: {
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x3240, 2);                     // 323e lda #$ff
        regs.x = 0x01; regs.setNZ(regs.x); m.step(0x3242, 2);                     // 3240 ldx #$01
        mem.write8(0x00c1, regs.a); m.step(0x3244, 3);
        mem.write8(0x00c2, regs.a); m.step(0x3246, 3);
        regs.sed(); m.step(0x3247, 2);                                            // 3246 sed
        regs.a = mem.read8(0x00fb); regs.setNZ(regs.a); m.step(0x3249, 3);        // 3247 lda $fb
        regs.clc(); m.step(0x324a, 2);                                            // 3249 clc
        regs.adc(mem.read8(0x018e)); m.step(0x324d, 4);                           // 324a adc $018e
        mem.write8(0x018e, regs.a); m.step(0x3250, 4);
        regs.a = mem.read8(0x00fc); regs.setNZ(regs.a); m.step(0x3252, 3);        // 3250 lda $fc
        regs.adc(mem.read8(0x018f)); m.step(0x3255, 4);                           // 3252 adc $018f
        mem.write8(0x018f, regs.a); m.step(0x3258, 4);
        regs.a = mem.read8(0x0190); regs.setNZ(regs.a); m.step(0x325b, 4);        // 3258 lda $0190
        regs.adc(0x00); m.step(0x325d, 2);                                        // 325b adc #$00
        mem.write8(0x0190, regs.a); m.step(0x3260, 4);
        regs.a = mem.read8(0x0191); regs.setNZ(regs.a); m.step(0x3263, 4);        // 3260 lda $0191
        regs.adc(0x00); m.step(0x3265, 2);                                        // 3263 adc #$00
        if (regs.fC) { m.step(0x3283, 3); label = 0x3283; continue; }            // 3265 bcs $3283
        m.step(0x3267, 2);
        mem.write8(0x0191, regs.a); m.step(0x326a, 4);
        regs.a = mem.read8(0x018b); regs.setNZ(regs.a); m.step(0x326d, 4);        // 326a lda $018b
        regs.clc(); m.step(0x326e, 2);                                            // 326d clc
        regs.adc(mem.read8(0x0089)); m.step(0x3270, 3);                           // 326e adc $89
        mem.write8(0x018b, regs.a); m.step(0x3273, 4);
        regs.a = mem.read8(0x018c); regs.setNZ(regs.a); m.step(0x3276, 4);        // 3273 lda $018c
        regs.adc(0x00); m.step(0x3278, 2);                                        // 3276 adc #$00
        mem.write8(0x018c, regs.a); m.step(0x327b, 4);
        regs.a = mem.read8(0x018d); regs.setNZ(regs.a); m.step(0x327e, 4);        // 327b lda $018d
        regs.adc(0x00); m.step(0x3280, 2);                                        // 327e adc #$00
        mem.write8(0x018d, regs.a); m.step(0x3283, 4);
        label = 0x3283; continue;
      }
      case 0x3283: {
        regs.cld(); m.step(0x3284, 2);                                            // 3283 cld
        label = 0x3284; continue;
      }
      case 0x3284: {
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3286, 2);                     // 3284 ldy #$00
        label = 0x3286; continue;
      }
      case 0x3286: {
        regs.a = mem.read8((0x0002 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x3289, 4); // 3286 lda $0002,y
        regs.cmp(mem.read8((0xa8 + regs.x) & 0xff)); m.step(0x328b, 4);           // 3289 cmp $a8,x
        regs.a = mem.read8((0x0003 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x328e, 4); // 328b lda $0003,y
        regs.sbc(mem.read8((0xaa + regs.x) & 0xff)); m.step(0x3290, 4);           // 328e sbc $aa,x
        regs.a = mem.read8((0x0004 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x3293, 4); // 3290 lda $0004,y
        regs.sbc(mem.read8((0xac + regs.x) & 0xff)); m.step(0x3295, 4);           // 3293 sbc $ac,x
        if (regs.fNC) { m.step(0x32c5, 3); label = 0x32c5; continue; }           // 3295 bcc $32c5
        m.step(0x3297, 2);
        regs.y = regs.inc8(regs.y); m.step(0x3298, 2);                            // 3297 iny
        regs.y = regs.inc8(regs.y); m.step(0x3299, 2);                            // 3298 iny
        regs.y = regs.inc8(regs.y); m.step(0x329a, 2);                            // 3299 iny
        regs.cpy(0x18); m.step(0x329c, 2);                                        // 329a cpy #$18
        if (regs.fNC) { m.step(0x3286, 3); label = 0x3286; continue; }           // 329c bcc $3286
        m.step(0x329e, 2);
        label = 0x329e; continue;
      }
      case 0x329e: {
        regs.x = regs.dec8(regs.x); m.step(0x329f, 2);                            // 329e dex
        if (regs.fPl) { m.step(0x3284, 3); label = 0x3284; continue; }           // 329f bpl $3284
        m.step(0x32a1, 2);
        regs.a = mem.read8(0x00c2); regs.setNZ(regs.a); m.step(0x32a3, 3);        // 32a1 lda $c2
        if (regs.fN) { m.step(0x32b3, 3); label = 0x32b3; continue; }            // 32a3 bmi $32b3
        m.step(0x32a5, 2);
        regs.cmp(mem.read8(0x00c1)); m.step(0x32a7, 3);                           // 32a5 cmp $c1
        if (regs.fNC) { m.step(0x32b3, 3); label = 0x32b3; continue; }           // 32a7 bcc $32b3
        m.step(0x32a9, 2);
        regs.adc(0x02); m.step(0x32ab, 2);                                        // 32a9 adc #$02
        regs.cmp(0x18); m.step(0x32ad, 2);                                        // 32ab cmp #$18
        if (regs.fNC) { m.step(0x32b1, 3); label = 0x32b1; continue; }           // 32ad bcc $32b1
        m.step(0x32af, 2);
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x32b1, 2);                     // 32af lda #$ff
        label = 0x32b1; continue;
      }
      case 0x32b1: {
        mem.write8(0x00c2, regs.a); m.step(0x32b3, 3);
        label = 0x32b3; continue;
      }
      case 0x32b3: {
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x32b5, 2);                     // 32b3 lda #$00
        mem.write8(0x00c0, regs.a); m.step(0x32b7, 3);
        regs.a = mem.read8(0x00c2); regs.setNZ(regs.a); m.step(0x32b9, 3);        // 32b7 lda $c2
        regs.and(mem.read8(0x00c1)); m.step(0x32bb, 3);                           // 32b9 and $c1
        if (regs.fPl) { m.step(0x32c4, 3); label = 0x32c4; continue; }           // 32bb bpl $32c4
        m.step(0x32bd, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x32bf, 2);                     // 32bd lda #$00
        mem.write8(0x0001, regs.a); m.step(0x32c1, 3);
        m.push16(0x32c3); m.step(0x32c4, 6); m.call(0x2d5c);                                        // 32c1 jsr $2d5c
        label = 0x32c4; continue;
      }
      case 0x32c4: {
        return m.ret(6);                                                          // 32c4 rts
      }
      case 0x32c5: {
        mem.write8(0x008d, regs.x); m.step(0x32c7, 3);
        mem.write8(0x008e, regs.y); m.step(0x32c9, 3);
        mem.write8((0xc1 + regs.x) & 0xff, regs.y); m.step(0x32cb, 4);
        regs.x = 0x17; regs.setNZ(regs.x); m.step(0x32cd, 2);                     // 32cb ldx #$17
        label = 0x32cd; continue;
      }
      case 0x32cd: {
        regs.a = mem.read8((0x17 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x32cf, 4); // 32cd lda $17,x
        mem.write8((0x1a + regs.x) & 0xff, regs.a); m.step(0x32d1, 4);
        const a0 = (0xffff + regs.x) & 0xffff;                                    // 32d1 lda $ffff,x
        regs.a = mem.read8(a0); regs.setNZ(regs.a); m.step(0x32d4, (a0 & 0xff00) !== 0xff00 ? 5 : 4);
        mem.write8((0x02 + regs.x) & 0xff, regs.a); m.step(0x32d6, 4);
        regs.x = regs.dec8(regs.x); m.step(0x32d7, 2);                            // 32d6 dex
        regs.cpx(mem.read8(0x008e)); m.step(0x32d9, 3);                           // 32d7 cpx $8e
        if (regs.fNZ) { m.step(0x32cd, 3); label = 0x32cd; continue; }           // 32d9 bne $32cd
        m.step(0x32db, 2);
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x32dd, 2);                     // 32db lda #$01
        mem.write8((0x1a + regs.x) & 0xff, regs.a); m.step(0x32df, 4);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x32e1, 2);                     // 32df lda #$00
        mem.write8((0x1b + regs.x) & 0xff, regs.a); m.step(0x32e3, 4);
        mem.write8((0x1c + regs.x) & 0xff, regs.a); m.step(0x32e5, 4);
        mem.write8(0x00b9, regs.a); m.step(0x32e7, 3);
        regs.x = mem.read8(0x008d); regs.setNZ(regs.x); m.step(0x32e9, 3);        // 32e7 ldx $8d
        regs.a = mem.read8((0xac + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x32eb, 4); // 32e9 lda $ac,x
        mem.write8((0x0004 + regs.y) & 0xffff, regs.a); m.step(0x32ee, 5);
        regs.a = mem.read8((0xaa + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x32f0, 4); // 32ee lda $aa,x
        mem.write8((0x0003 + regs.y) & 0xffff, regs.a); m.step(0x32f3, 5);
        regs.a = mem.read8((0xa8 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x32f5, 4); // 32f3 lda $a8,x
        mem.write8((0x0002 + regs.y) & 0xffff, regs.a); m.step(0x32f8, 5);
        regs.a = 0xf0; regs.setNZ(regs.a); m.step(0x32fa, 2);                     // 32f8 lda #$f0
        mem.write8(0x0001, regs.a); m.step(0x32fc, 3);
        if (regs.fNZ) { m.step(0x329e, 3); label = 0x329e; continue; }           // 32fc bne $329e
        m.step(0x32fe, 2); return m.call(0x32fe);                                 // 32fc fall-through -> loc_32fe
      }
    }
  }
}
