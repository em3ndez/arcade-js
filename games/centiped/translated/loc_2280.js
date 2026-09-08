// SPDX-License-Identifier: GPL-3.0-only
// loc_2280  (ROM 0x2280-0x22fa) -- stores A to $71, optionally clears a ($32),Y cell (calls 0x2b91),
// range-checks $61/$71/$81, BCD-adjusts $ab,X through $8d, then dispatches 0x2c6b/0x382d/0x2c96
// (or 0x21c7 via the RTS at 0x22f6 when $61 = $ff).
export function loc_2280(m) {
  const { regs, mem } = m;
  let label = 0x2280;
  for (;;) {
    switch (label) {
      case 0x2280: {
        mem.write8(0x0071, regs.a); m.step(0x2282, 3);                                                 // 2280 sta $71
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2284, 2);                                           // 2282 ldy #$00
        m.step(0x2287, 6); m.call(0x2c2b);                                                              // 2284 jsr $2c2b
        if (regs.fZ) { m.step(0x229c, 3); label = 0x229c; continue; }                                   // 2287 beq $229c
        m.step(0x2289, 2);                                                                              // 2287 beq (fall)
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x228b, 2);                                           // 2289 ldy #$00
        { const b = mem.read16(0x0032); const ea = (b + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x228d, 5 + ((b & 0xff00) !== (ea & 0xff00) ? 1 : 0)); } // 228b lda ($32),y
        regs.and(0x3f); m.step(0x228f, 2);
        regs.cmp(0x38); m.step(0x2291, 2);                                                              // 228f cmp #$38
        if (regs.fNC) { m.step(0x229c, 3); label = 0x229c; continue; }                                 // 2291 bcc $229c
        m.step(0x2293, 2);                                                                              // 2291 bcc (fall)
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2295, 2);
        { const ea = (mem.read16(0x0032) + regs.y) & 0xffff; mem.write8(ea, regs.a); m.step(0x2297, 6); } // 2295 sta ($32),y
        m.step(0x229a, 6); m.call(0x2b91);                                                              // 2297 jsr $2b91
        regs.x = 0x0d; regs.setNZ(regs.x); m.step(0x229c, 2);                                           // 229a ldx #$0d
        label = 0x229c; continue;
      }
      case 0x229c: {
        regs.a = mem.read8(0x0061); regs.setNZ(regs.a); m.step(0x229e, 3);                              // 229c lda $61
        regs.cmp(0xff); m.step(0x22a0, 2);                                                              // 229e cmp #$ff
        if (regs.fC) { m.step(0x22f6, 3); label = 0x22f6; continue; }                                   // 22a0 bcs $22f6
        m.step(0x22a2, 2);                                                                              // 22a0 bcs (fall)
        regs.a = mem.read8(0x0071); regs.setNZ(regs.a); m.step(0x22a4, 3);                              // 22a2 lda $71
        regs.eor(mem.read8(0x00f0)); m.step(0x22a6, 3);
        regs.cmp(0x09); m.step(0x22a8, 2);
        if (regs.fC) { m.step(0x22b0, 3); label = 0x22b0; continue; }                                   // 22a8 bcs $22b0
        m.step(0x22aa, 2);                                                                              // 22a8 bcs (fall)
        regs.a = mem.read8(0x0081); regs.setNZ(regs.a); m.step(0x22ac, 3);                              // 22aa lda $81
        if (regs.fPl) { m.step(0x22eb, 3); label = 0x22eb; continue; }                                  // 22ac bpl $22eb
        m.step(0x22ae, 2);                                                                              // 22ac bpl (fall)
        if (regs.fN) { m.step(0x22e2, 3); label = 0x22e2; continue; }                                   // 22ae bmi $22e2
        m.step(0x22b0, 2);                                                                              // 22ae bmi (fall)
        label = 0x22b0; continue;
      }
      case 0x22b0: {
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x22b2, 3);                              // 22b0 ldx $88
        regs.a = mem.read8((0x00ab + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x22b4, 4);            // 22b2 lda $ab,x
        regs.sed(); m.step(0x22b5, 2);
        regs.sec(); m.step(0x22b6, 2);
        regs.sbc(0x06); m.step(0x22b8, 2);
        regs.cld(); m.step(0x22b9, 2);
        if (regs.fPl) { m.step(0x22bd, 3); label = 0x22bd; continue; }                                  // 22b9 bpl $22bd
        m.step(0x22bb, 2);                                                                              // 22b9 bpl (fall)
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x22bd, 2);
        label = 0x22bd; continue;
      }
      case 0x22bd: {
        regs.a = regs.lsr(regs.a); m.step(0x22be, 2);
        regs.cmp(0x06); m.step(0x22c0, 2);
        if (regs.fNC) { m.step(0x22c4, 3); label = 0x22c4; continue; }                                  // 22c0 bcc $22c4
        m.step(0x22c2, 2);                                                                              // 22c0 bcc (fall)
        regs.a = 0x05; regs.setNZ(regs.a); m.step(0x22c4, 2);
        label = 0x22c4; continue;
      }
      case 0x22c4: {
        regs.a = regs.asl(regs.a); m.step(0x22c5, 2);
        regs.a = regs.asl(regs.a); m.step(0x22c6, 2);
        regs.a = regs.asl(regs.a); m.step(0x22c7, 2);
        mem.write8(0x008d, regs.a); m.step(0x22c9, 3);                                                  // 22c7 sta $8d
        regs.a = 0x60; regs.setNZ(regs.a); m.step(0x22cb, 2);                                           // 22c9 lda #$60
        regs.eor(mem.read8(0x00f0)); m.step(0x22cd, 3);
        regs.sec(); m.step(0x22ce, 2);
        regs.sbc(mem.read8(0x008d)); m.step(0x22d0, 3);
        regs.x = mem.read8(0x00ef); regs.setNZ(regs.x); m.step(0x22d2, 3);                              // 22d0 ldx $ef
        if (regs.fZ) { m.step(0x22da, 3); label = 0x22da; continue; }                                   // 22d2 beq $22da
        m.step(0x22d4, 2);                                                                              // 22d2 beq (fall)
        regs.cmp(mem.read8(0x0071)); m.step(0x22d6, 3);                                                 // 22d4 cmp $71
        if (regs.fNC) { m.step(0x22e2, 3); label = 0x22e2; continue; }                                  // 22d6 bcc $22e2
        m.step(0x22d8, 2);                                                                              // 22d6 bcc (fall)
        if (regs.fC) { m.step(0x22de, 3); label = 0x22de; continue; }                                   // 22d8 bcs $22de
        m.step(0x22da, 2);                                                                              // 22d8 bcs (fall)
        label = 0x22da; continue;
      }
      case 0x22da: {
        regs.cmp(mem.read8(0x0071)); m.step(0x22dc, 3);                                                 // 22da cmp $71
        if (regs.fC) { m.step(0x22e2, 3); label = 0x22e2; continue; }                                   // 22dc bcs $22e2
        m.step(0x22de, 2);                                                                              // 22dc bcs (fall)
        label = 0x22de; continue;
      }
      case 0x22de: {
        regs.a = mem.read8(0x0081); regs.setNZ(regs.a); m.step(0x22e0, 3);                              // 22de lda $81
        if (regs.fN) { m.step(0x22eb, 3); label = 0x22eb; continue; }                                   // 22e0 bmi $22eb
        m.step(0x22e2, 2);                                                                              // 22e0 bmi (fall)
        label = 0x22e2; continue;
      }
      case 0x22e2: {
        regs.x = 0x0d; regs.setNZ(regs.x); m.step(0x22e4, 2);                                           // 22e2 ldx #$0d
        m.step(0x22e7, 6); m.call(0x2c6b);                                                              // 22e4 jsr $2c6b
        if (regs.fNC) { m.step(0x22f0, 3); label = 0x22f0; continue; }                                  // 22e7 bcc $22f0
        m.step(0x22e9, 2);                                                                              // 22e7 bcc (fall)
        regs.a = mem.read8(0x0081); regs.setNZ(regs.a); m.step(0x22eb, 3);                              // 22e9 lda $81
        label = 0x22eb; continue;
      }
      case 0x22eb: {
        m.step(0x22ee, 6); m.call(0x382d);                                                              // 22eb jsr $382d
        mem.write8(0x0081, regs.a); m.step(0x22f0, 3);                                                  // 22ee sta $81
        label = 0x22f0; continue;
      }
      case 0x22f0: {
        regs.x = 0x0d; regs.setNZ(regs.x); m.step(0x22f2, 2);                                           // 22f0 ldx #$0d
        m.step(0x22f5, 6); m.call(0x2c96);                                                              // 22f2 jsr $2c96
        return m.ret(6);                                                                                // 22f5 rts
      }
      case 0x22f6: {
        m.step(0x22f9, 6); m.call(0x21c7);                                                              // 22f6 jsr $21c7
        return m.ret(6);                                                                                // 22f9 rts
      }
    }
  }
}
