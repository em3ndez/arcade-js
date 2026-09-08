// SPDX-License-Identifier: GPL-3.0-only
// loc_2db6  (ROM 0x2db6-0x2e0a) -- when $86 is non-negative, BCD-advances the 16-bit $a7,x/$a9,x accumulator
// (rolling $a1,x/$ab,x on carry); on reaching the $ad,x/$af,x target, indexes loc_21b3 + $21c0,y, steps $a4,x
// and pings loc_26b8; restores X from $8d and RTS. (2dfd BCS-to-self = watchdog hang if $a4,x > 6.)
export function loc_2db6(m) {
  const { regs, mem } = m;
  let label = 0x2db6;
  for (;;) {
    switch (label) {
      case 0x2db6: {
        regs.y = mem.read8(0x0086); regs.setNZ(regs.y); m.step(0x2db8, 3);              // 2db6 ldy $86
        if (regs.fN) { m.step(0x2e0a, 4); label = 0x2e0a; continue; }                   // 2db8 bmi $2e0a (page cross)
        m.step(0x2dba, 2);
        mem.write8(0x008d, regs.x); m.step(0x2dbc, 3);                                  // 2dba stx $8d
        regs.sed(); m.step(0x2dbd, 2);
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2dbf, 3);              // 2dbd ldx $88
        regs.clc(); m.step(0x2dc0, 2);
        regs.adc(mem.read8((0x00a7 + regs.x) & 0xff)); m.step(0x2dc2, 4);               // 2dc0 adc $a7,x
        mem.write8((0x00a7 + regs.x) & 0xff, regs.a); m.step(0x2dc4, 4);                // 2dc2 sta $a7,x
        regs.a = mem.read8((0x00a9 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2dc6, 4); // 2dc4 lda $a9,x
        regs.adc(mem.read8(0x008b)); m.step(0x2dc8, 3);                                 // 2dc6 adc $8b
        mem.write8((0x00a9 + regs.x) & 0xff, regs.a); m.step(0x2dca, 4);                // 2dc8 sta $a9,x
        if (regs.fNC) { m.step(0x2dd9, 3); label = 0x2dd9; continue; }                  // 2dca bcc $2dd9
        m.step(0x2dcc, 2);
        regs.a = mem.read8((0x00a1 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2dce, 4); // 2dcc lda $a1,x
        regs.sbc(0x02); m.step(0x2dd0, 2);
        mem.write8((0x00a1 + regs.x) & 0xff, regs.a); m.step(0x2dd2, 4);                // 2dd0 sta $a1,x
        regs.a = mem.read8((0x00ab + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2dd4, 4); // 2dd2 lda $ab,x
        regs.clc(); m.step(0x2dd5, 2);
        regs.adc(0x01); m.step(0x2dd7, 2);
        mem.write8((0x00ab + regs.x) & 0xff, regs.a); m.step(0x2dd9, 4);                // 2dd7 sta $ab,x
        label = 0x2dd9; continue;
      }
      case 0x2dd9: {
        regs.cld(); m.step(0x2dda, 2);
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2ddc, 3);              // 2dda ldx $88
        regs.a = mem.read8((0x00a9 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2dde, 4); // 2ddc lda $a9,x
        regs.cmp(mem.read8((0x00ad + regs.x) & 0xff)); m.step(0x2de0, 4);               // 2dde cmp $ad,x
        regs.a = mem.read8((0x00ab + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2de2, 4); // 2de0 lda $ab,x
        regs.sbc(mem.read8((0x00af + regs.x) & 0xff)); m.step(0x2de4, 4);               // 2de2 sbc $af,x
        if (regs.fNC) { m.step(0x2e08, 4); label = 0x2e08; continue; }                  // 2de4 bcc $2e08 (page cross)
        m.step(0x2de6, 2);
        m.push16(0x2de8); m.step(0x2de9, 6); m.call(0x21b3);                                             // 2de6 jsr $21b3
        regs.sed(); m.step(0x2dea, 2);
        regs.clc(); m.step(0x2deb, 2);
        regs.adc(mem.read8((0x00ad + regs.x) & 0xff)); m.step(0x2ded, 4);               // 2deb adc $ad,x
        mem.write8((0x00ad + regs.x) & 0xff, regs.a); m.step(0x2def, 4);                // 2ded sta $ad,x
        { const b = 0x21c0, a = (b + regs.y) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x2df2, (b & 0xff00) !== (a & 0xff00) ? 5 : 4); } // 2def lda $21c0,y
        regs.adc(mem.read8((0x00af + regs.x) & 0xff)); m.step(0x2df4, 4);               // 2df2 adc $af,x
        mem.write8((0x00af + regs.x) & 0xff, regs.a); m.step(0x2df6, 4);                // 2df4 sta $af,x
        regs.cld(); m.step(0x2df7, 2);
        regs.a = mem.read8((0x00a4 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2df9, 4); // 2df7 lda $a4,x
        regs.cmp(0x06); m.step(0x2dfb, 2);
        if (regs.fZ) { m.step(0x2e08, 4); label = 0x2e08; continue; }                   // 2dfb beq $2e08 (page cross)
        m.step(0x2dfd, 2);
        while (regs.fC) { m.step(0x2dfd, 3); }                                          // 2dfd bcs $2dfd (spin: watchdog hang if $a4,x > 6)
        m.step(0x2dff, 2);
        mem.write8((0x00a4 + regs.x) & 0xff, regs.inc8(mem.read8((0x00a4 + regs.x) & 0xff))); m.step(0x2e01, 6); // 2dff inc $a4,x
        regs.a = 0x11; regs.setNZ(regs.a); m.step(0x2e03, 2);
        mem.write8(0x00b6, regs.a); m.step(0x2e05, 3);                                  // 2e03 sta $b6
        m.push16(0x2e07); m.step(0x2e08, 6); m.call(0x26b8);                                             // 2e05 jsr $26b8
        label = 0x2e08; continue;
      }
      case 0x2e08: {
        regs.x = mem.read8(0x008d); regs.setNZ(regs.x); m.step(0x2e0a, 3);              // 2e08 ldx $8d
        label = 0x2e0a; continue;
      }
      case 0x2e0a: {
        return m.ret(6);                                                                // 2e0a rts
      }
    }
  }
}
