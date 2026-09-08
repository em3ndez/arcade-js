// SPDX-License-Identifier: GPL-3.0-only
// loc_2d5c  (ROM 0x2d5c-0x2dad) -- loops Y=$8d over records at $0002/$0003/$0004,Y, feeding each byte to
// 0x384f/0x3836/0x3833 while cycling the $91 index (AND #$1f / ORA #$40) until Y reaches $18; RTS.
export function loc_2d5c(m) {
  const { regs, mem } = m;
  regs.a = 0x07; regs.setNZ(regs.a); m.step(0x2d5e, 2);                                                 // 2d5c lda #$07
  m.step(0x2d61, 6); m.call(0x37d5);                                                                    // 2d5e jsr $37d5
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2d63, 2);                                                 // 2d61 ldy #$00
  regs.x = 0x5c; regs.setNZ(regs.x); m.step(0x2d65, 2);                                                 // 2d63 ldx #$5c
  for (;;) {
    mem.write8(0x0091, regs.x); m.step(0x2d67, 3);                                                      // 2d65 stx $91
    regs.a = 0x05; regs.setNZ(regs.a); m.step(0x2d69, 2);
    mem.write8(0x0092, regs.a); m.step(0x2d6b, 3);
    { const base = 0x0004; const ea = (base + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2d6e, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); } // 2d6b lda $0004,y
    mem.write8(0x008d, regs.y); m.step(0x2d70, 3);
    regs.sec(); m.step(0x2d71, 2);
    m.step(0x2d74, 6); m.call(0x384f);                                                                  // 2d71 jsr $384f
    regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x2d76, 3);
    { const base = 0x0003; const ea = (base + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2d79, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); } // 2d76 lda $0003,y
    m.step(0x2d7c, 6); m.call(0x384f);                                                                  // 2d79 jsr $384f
    regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x2d7e, 3);
    { const base = 0x0002; const ea = (base + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2d81, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); } // 2d7e lda $0002,y
    regs.clc(); m.step(0x2d82, 2);
    m.step(0x2d85, 6); m.call(0x384f);                                                                  // 2d82 jsr $384f
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2d87, 2);
    m.step(0x2d8a, 6); m.call(0x3836);                                                                  // 2d87 jsr $3836
    regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x2d8c, 3);
    m.step(0x2d8f, 6); m.call(0x3833);                                                                  // 2d8c jsr $3833
    mem.write8(0x008d, regs.inc8(mem.read8(0x008d))); m.step(0x2d91, 5);                                // 2d8f inc $8d
    regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x2d93, 3);
    m.step(0x2d96, 6); m.call(0x3833);                                                                  // 2d93 jsr $3833
    mem.write8(0x008d, regs.inc8(mem.read8(0x008d))); m.step(0x2d98, 5);                                // 2d96 inc $8d
    regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x2d9a, 3);
    m.step(0x2d9d, 6); m.call(0x3833);                                                                  // 2d9a jsr $3833
    regs.a = mem.read8(0x0091); regs.setNZ(regs.a); m.step(0x2d9f, 3);                                  // 2d9d lda $91
    regs.and(0x1f); m.step(0x2da1, 2);
    regs.ora(0x40); m.step(0x2da3, 2);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0x2da4, 2);                                             // 2da3 tax
    regs.x = regs.dec8(regs.x); m.step(0x2da5, 2);
    regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x2da7, 3);                                  // 2da5 ldy $8d
    regs.y = regs.inc8(regs.y); m.step(0x2da8, 2);                                                      // 2da7 iny
    regs.cpy(0x18); m.step(0x2daa, 2);                                                                  // 2da8 cpy #$18
    if (regs.fNC) { m.step(0x2d65, 3); continue; }                                                      // 2daa bcc $2d65
    m.step(0x2dac, 2);                                                                                  // 2daa bcc (fall)
    return m.ret(6);                                                                                    // 2dac rts
  }
}
