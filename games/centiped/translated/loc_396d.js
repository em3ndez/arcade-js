// SPDX-License-Identifier: GPL-3.0-only
// loc_396d  (ROM 0x396d-0x39ea) -- IRQ tail: $0c00 self-test/coin poll + $d5 counter, LED/output
// writes to $1404,X / $1c00,X / $2003,X / $0104,X (via 0x335e), per-axis trak-ball delta accumulate
// from $0c00,X into $b9,X/$ba,X, STA $1800, restore Y/X/A off the stack, RTI.
export function loc_396d(m) {
  const { regs, mem } = m;
  let label = 0x396d;
  for (;;) {
    switch (label) {
      case 0x396d: {
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3970, 4);            // 396d lda $0c00
        regs.and(0x20); m.step(0x3972, 2);                                            // 3970 and #$20
        if (regs.fNZ) { m.step(0x3993, 3); label = 0x3993; continue; }                // 3972 bne $3993
        m.step(0x3974, 2);
        regs.a = mem.read8(0x00d5); regs.setNZ(regs.a); m.step(0x3976, 3);            // 3974 lda $d5
        if (regs.fN) { m.step(0x39b3, 3); label = 0x39b3; continue; }                 // 3976 bmi $39b3
        m.step(0x3978, 2);
        mem.write8(0x00d5, regs.inc8(mem.read8(0x00d5))); m.step(0x397a, 5);          // 3978 inc $d5
        regs.bit(mem.read8(0x0c00)); m.step(0x397d, 4);                               // 397a bit $0c00
        if (regs.fNV) { m.step(0x3983, 3); label = 0x3983; continue; }                // 397d bvc $3983
        m.step(0x397f, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3981, 2);                         // 397f lda #$00
        mem.write8(0x00d5, regs.a); m.step(0x3983, 3);                                // 3981 sta $d5
        label = 0x3983; continue;
      }
      case 0x3983: {
        regs.a = mem.read8(0x00d5); regs.setNZ(regs.a); m.step(0x3985, 3);            // 3983 lda $d5
        regs.a = regs.asl(regs.a); m.step(0x3986, 2);
        regs.a = regs.asl(regs.a); m.step(0x3987, 2);
        regs.x = 0x03; regs.setNZ(regs.x); m.step(0x3989, 2);                         // 3987 ldx #$03
        label = 0x3989; continue;
      }
      case 0x3989: {
        mem.write8((0x1404 + regs.x) & 0xffff, regs.a); m.step(0x398c, 5);            // 3989 sta $1404,x
        regs.adc(0x01); m.step(0x398e, 2);                                            // 398c adc #$01
        regs.x = regs.dec8(regs.x); m.step(0x398f, 2);                                // 398e dex
        if (regs.fPl) { m.step(0x3989, 3); label = 0x3989; continue; }                // 398f bpl $3989
        m.step(0x3991, 2);
        if (regs.fN) { m.step(0x39b3, 3); label = 0x39b3; continue; }                 // 3991 bmi $39b3
        m.step(0x3993, 2);
        label = 0x3993; continue;
      }
      case 0x3993: {
        m.push16(0x3995); m.step(0x3996, 6); m.call(0x335e);                                            // 3993 jsr $335e
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0x3998, 2);                         // 3996 ldx #$02
        label = 0x3998; continue;
      }
      case 0x3998: {
        regs.a = mem.read8((0x00c5 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x399a, 4); // 3998 lda $c5,x
        mem.write8((0x1c00 + regs.x) & 0xffff, regs.a); m.step(0x399d, 5);            // 399a sta $1c00,x
        regs.x = regs.dec8(regs.x); m.step(0x399e, 2);                                // 399d dex
        if (regs.fPl) { m.step(0x3998, 3); label = 0x3998; continue; }                // 399e bpl $3998
        m.step(0x39a0, 2);
        regs.x = 0x0a; regs.setNZ(regs.x); m.step(0x39a2, 2);                         // 39a0 ldx #$0a
        regs.a = 0xf4; regs.setNZ(regs.a); m.step(0x39a4, 2);                         // 39a2 lda #$f4
        label = 0x39a4; continue;
      }
      case 0x39a4: {
        const a39a4 = (0x2003 + regs.x) & 0xffff;
        regs.eor(mem.read8(a39a4)); m.step(0x39a7, 4 + ((0x2003 & 0xff00) !== (a39a4 & 0xff00) ? 1 : 0)); // 39a4 eor $2003,x
        regs.x = regs.dec8(regs.x); m.step(0x39a8, 2);                                // 39a7 dex
        if (regs.fPl) { m.step(0x39a4, 3); label = 0x39a4; continue; }                // 39a8 bpl $39a4
        m.step(0x39aa, 2);
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x39ab, 2);                       // 39aa tax
        if (regs.fZ) { m.step(0x39b3, 3); label = 0x39b3; continue; }                 // 39ab beq $39b3
        m.step(0x39ad, 2);
        regs.x = regs.s; regs.setNZ(regs.x); m.step(0x39ae, 2);                       // 39ad tsx
        regs.a = 0x03; regs.setNZ(regs.a); m.step(0x39b0, 2);                         // 39ae lda #$03
        mem.write8((0x0104 + regs.x) & 0xffff, regs.a); m.step(0x39b3, 5);            // 39b0 sta $0104,x
        label = 0x39b3; continue;
      }
      case 0x39b3: {
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0x39b5, 2);                         // 39b3 ldx #$02
        label = 0x39b5; continue;
      }
      case 0x39b5: {
        const a39b5 = (0x0c00 + regs.x) & 0xffff;
        regs.a = mem.read8(a39b5); regs.setNZ(regs.a); m.step(0x39b8, 4 + ((0x0c00 & 0xff00) !== (a39b5 & 0xff00) ? 1 : 0)); // 39b5 lda $0c00,x
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x39b9, 2);                       // 39b8 tay
        regs.sec(); m.step(0x39ba, 2);                                                // 39b9 sec
        regs.sbc(mem.read8((0x00bd + regs.x) & 0xff)); m.step(0x39bc, 4);             // 39ba sbc $bd,x
        mem.write8((0x00bd + regs.x) & 0xff, regs.y); m.step(0x39be, 4);              // 39bc sty $bd,x
        regs.and(0x0f); m.step(0x39c0, 2);
        regs.cmp(0x08); m.step(0x39c2, 2);
        if (regs.fNC) { m.step(0x39c6, 3); label = 0x39c6; continue; }                // 39c2 bcc $39c6
        m.step(0x39c4, 2);
        regs.ora(0xf0); m.step(0x39c6, 2);
        label = 0x39c6; continue;
      }
      case 0x39c6: {
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x39c7, 2);                       // 39c6 tay
        if (regs.fZ) { m.step(0x39dd, 3); label = 0x39dd; continue; }                 // 39c7 beq $39dd
        m.step(0x39c9, 2);
        regs.eor(mem.read8((0x00ba + regs.x) & 0xff)); m.step(0x39cb, 4);             // 39c9 eor $ba,x
        if (regs.fPl) { m.step(0x39d5, 3); label = 0x39d5; continue; }                // 39cb bpl $39d5
        m.step(0x39cd, 2);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x39ce, 2);                       // 39cd tya
        const a39ce = (0x0c00 + regs.x) & 0xffff;
        regs.eor(mem.read8(a39ce)); m.step(0x39d1, 4 + ((0x0c00 & 0xff00) !== (a39ce & 0xff00) ? 1 : 0)); // 39ce eor $0c00,x
        if (regs.fPl) { m.step(0x39d5, 3); label = 0x39d5; continue; }                // 39d1 bpl $39d5
        m.step(0x39d3, 2);
        regs.y = mem.read8((0x00ba + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x39d5, 4); // 39d3 ldy $ba,x
        label = 0x39d5; continue;
      }
      case 0x39d5: {
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x39d6, 2);                       // 39d5 tya
        mem.write8((0x00ba + regs.x) & 0xff, regs.a); m.step(0x39d8, 4);              // 39d6 sta $ba,x
        regs.clc(); m.step(0x39d9, 2);                                                // 39d8 clc
        regs.adc(mem.read8((0x00b9 + regs.x) & 0xff)); m.step(0x39db, 4);             // 39d9 adc $b9,x
        mem.write8((0x00b9 + regs.x) & 0xff, regs.a); m.step(0x39dd, 4);              // 39db sta $b9,x
        label = 0x39dd; continue;
      }
      case 0x39dd: {
        regs.x = regs.dec8(regs.x); m.step(0x39de, 2);                               // 39dd dex
        regs.x = regs.dec8(regs.x); m.step(0x39df, 2);                               // 39de dex
        if (regs.fPl) { m.step(0x39b5, 3); label = 0x39b5; continue; }                // 39df bpl $39b5
        m.step(0x39e1, 2);
        mem.write8(0x1800, regs.a); m.step(0x39e4, 4);                                // 39e1 sta $1800
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x39e5, 4);                    // 39e4 pla
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x39e6, 2);                       // 39e5 tay
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x39e7, 4);                    // 39e6 pla
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x39e8, 2);                       // 39e7 tax
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x39e9, 4);                    // 39e8 pla
        return m.rti(6);                                                              // 39e9 rti
      }
    }
  }
}
