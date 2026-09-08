// SPDX-License-Identifier: GPL-3.0-only
// loc_341b  (ROM 0x341b-0x346c) -- from ($d3 & 3): if nonzero, carry-chains an ADC across the $c9/$cb pair
// (INC $c8 once/twice per CPY #2) and stores $c9; then INC $d4 and, on even frames, sweeps $c5..$c7 twice --
// pass 1 (0x3449) subtracts $10 from each byte >= $10 (counting adjustments in Y), pass 2 (0x345e, only when
// none adjusted) subtracts $11 with a BMI early-out. RTS.
export function loc_341b(m) {
  const { regs, mem } = m;
  let label = 0x341b;
  for (;;) {
    switch (label) {
      case 0x341b: {
        regs.a = mem.read8(0x00d3); regs.setNZ(regs.a); m.step(0x341d, 3);              // 341b lda $d3
        regs.and(0x03); m.step(0x341f, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3420, 2);                          // 341f tay
        if (regs.fZ) { m.step(0x343c, 3); label = 0x343c; continue; }                    // 3420 beq $343c
        m.step(0x3422, 2);                                                               // 3420 beq (fall)
        regs.a = regs.lsr(regs.a); m.step(0x3423, 2);
        regs.adc(0x00); m.step(0x3425, 2);
        regs.eor(0xff); m.step(0x3427, 2);
        regs.sec(); m.step(0x3428, 2);
        regs.adc(mem.read8(0x00c9)); m.step(0x342a, 3);
        if (regs.fC) { m.step(0x3434, 3); label = 0x3434; continue; }                    // 342a bcs $3434
        m.step(0x342c, 2);                                                               // 342a bcs (fall)
        regs.adc(mem.read8(0x00cb)); m.step(0x342e, 3);
        if (regs.fN) { m.step(0x343e, 3); label = 0x343e; continue; }                    // 342e bmi $343e
        m.step(0x3430, 2);                                                               // 342e bmi (fall)
        mem.write8(0x00cb, regs.a); m.step(0x3432, 3);                                   // 3430 sta $cb
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3434, 2);                            // 3432 lda #$00
        label = 0x3434; continue;
      }
      case 0x3434: {
        regs.cpy(0x02); m.step(0x3436, 2);                                              // 3434 cpy #$02
        if (regs.fC) { m.step(0x343a, 3); label = 0x343a; continue; }                    // 3436 bcs $343a
        m.step(0x3438, 2);                                                               // 3436 bcs (fall)
        mem.write8(0x00c8, regs.inc8(mem.read8(0x00c8))); m.step(0x343a, 5);             // 3438 inc $c8
        label = 0x343a; continue;
      }
      case 0x343a: {
        mem.write8(0x00c8, regs.inc8(mem.read8(0x00c8))); m.step(0x343c, 5);             // 343a inc $c8
        label = 0x343c; continue;
      }
      case 0x343c: {
        mem.write8(0x00c9, regs.a); m.step(0x343e, 3);                                   // 343c sta $c9
        label = 0x343e; continue;
      }
      case 0x343e: {
        mem.write8(0x00d4, regs.inc8(mem.read8(0x00d4))); m.step(0x3440, 5);             // 343e inc $d4
        regs.a = mem.read8(0x00d4); regs.setNZ(regs.a); m.step(0x3442, 3);              // 3440 lda $d4
        regs.a = regs.lsr(regs.a); m.step(0x3443, 2);
        if (regs.fC) { m.step(0x346c, 3); label = 0x346c; continue; }                    // 3443 bcs $346c
        m.step(0x3445, 2);                                                               // 3443 bcs (fall)
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3447, 2);                            // 3445 ldy #$00
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0x3449, 2);                            // 3447 ldx #$02
        label = 0x3449; continue;
      }
      case 0x3449: {
        regs.a = mem.read8((0x00c5 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x344b, 4); // 3449 lda $c5,x
        if (regs.fZ) { m.step(0x3456, 3); label = 0x3456; continue; }                    // 344b beq $3456
        m.step(0x344d, 2);                                                               // 344b beq (fall)
        regs.cmp(0x10); m.step(0x344f, 2);                                              // 344d cmp #$10
        if (regs.fNC) { m.step(0x3456, 3); label = 0x3456; continue; }                   // 344f bcc $3456
        m.step(0x3451, 2);                                                               // 344f bcc (fall)
        regs.adc(0xef); m.step(0x3453, 2);                                              // 3451 adc #$ef
        regs.y = regs.inc8(regs.y); m.step(0x3454, 2);                                   // 3453 iny
        mem.write8((0x00c5 + regs.x) & 0xff, regs.a); m.step(0x3456, 4);                // 3454 sta $c5,x
        label = 0x3456; continue;
      }
      case 0x3456: {
        regs.x = regs.dec8(regs.x); m.step(0x3457, 2);                                   // 3456 dex
        if (regs.fPl) { m.step(0x3449, 3); label = 0x3449; continue; }                   // 3457 bpl $3449
        m.step(0x3459, 2);                                                               // 3457 bpl (fall)
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x345a, 2);                          // 3459 tya
        if (regs.fNZ) { m.step(0x346c, 3); label = 0x346c; continue; }                   // 345a bne $346c
        m.step(0x345c, 2);                                                               // 345a bne (fall)
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0x345e, 2);                            // 345c ldx #$02
        label = 0x345e; continue;
      }
      case 0x345e: {
        regs.a = mem.read8((0x00c5 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x3460, 4); // 345e lda $c5,x
        if (regs.fZ) { m.step(0x3469, 3); label = 0x3469; continue; }                    // 3460 beq $3469
        m.step(0x3462, 2);                                                               // 3460 beq (fall)
        regs.clc(); m.step(0x3463, 2);
        regs.adc(0xef); m.step(0x3465, 2);                                              // 3463 adc #$ef
        mem.write8((0x00c5 + regs.x) & 0xff, regs.a); m.step(0x3467, 4);                // 3465 sta $c5,x
        if (regs.fN) { m.step(0x346c, 3); label = 0x346c; continue; }                    // 3467 bmi $346c
        m.step(0x3469, 2);                                                               // 3467 bmi (fall)
        label = 0x3469; continue;
      }
      case 0x3469: {
        regs.x = regs.dec8(regs.x); m.step(0x346a, 2);                                   // 3469 dex
        if (regs.fPl) { m.step(0x345e, 3); label = 0x345e; continue; }                   // 346a bpl $345e
        m.step(0x346c, 2);                                                               // 346a bpl (fall)
        label = 0x346c; continue;
      }
      case 0x346c: {
        return m.ret(6);                                                                 // 346c rts
      }
    }
  }
}
