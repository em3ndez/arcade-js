// SPDX-License-Identifier: GPL-3.0-only
// loc_2c6b (ROM 0x2c6b-0x2c95) -- scans slots Y=$0c..0 for one sharing object X's $64 column, still active
// (<$f4), not slot X, and within $f4 rows; returns carry set on such a collision, clear otherwise.
export function loc_2c6b(m) {
  const { regs, mem } = m;
  mem.write8(0x008b, regs.x); m.step(0x2c6d, 3);                                                     // 2c6b stx $8b
  mem.write8(0x008c, regs.x); m.step(0x2c6f, 3);                                                     // 2c6d stx $8c
  mem.write8(0x008c, regs.inc8(mem.read8(0x008c))); m.step(0x2c71, 5);                               // 2c6f inc $8c
  regs.y = 0x0c; regs.setNZ(regs.y); m.step(0x2c73, 2);                                              // 2c71 ldy #$0c
  for (;;) {
    regs.a = mem.read8((0x0064 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x2c76, 4);           // 2c73 lda $0064,y
    regs.cmp(mem.read8((0x0064 + regs.x) & 0xff)); m.step(0x2c78, 4);                                // 2c76 cmp $64,x
    if (regs.fNZ) { m.step(0x2c91, 3); }                                                             // 2c78 bne $2c91
    else {
      m.step(0x2c7a, 2);
      regs.a = mem.read8((0x0034 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x2c7d, 4);         // 2c7a lda $0034,y
      regs.cmp(0xf4); m.step(0x2c7f, 2);                                                             // 2c7d cmp #$f4
      if (regs.fC) { m.step(0x2c91, 3); }                                                            // 2c7f bcs $2c91
      else {
        m.step(0x2c81, 2);
        regs.cpy(mem.read8(0x008b)); m.step(0x2c83, 3);                                              // 2c81 cpy $8b
        if (regs.fZ) { m.step(0x2c91, 3); }                                                          // 2c83 beq $2c91
        else {
          m.step(0x2c85, 2);
          regs.a = mem.read8((0x0054 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2c87, 4);       // 2c85 lda $54,x
          regs.sec(); m.step(0x2c88, 2);                                                             // 2c87 sec
          regs.sbc(mem.read8((0x0054 + regs.y) & 0xffff)); m.step(0x2c8b, 4);                        // 2c88 sbc $0054,y
          regs.eor(mem.read8((0x0044 + regs.x) & 0xff)); m.step(0x2c8d, 4);                          // 2c8b eor $44,x
          regs.cmp(0xf4); m.step(0x2c8f, 2);                                                         // 2c8d cmp #$f4
          if (regs.fC) { m.step(0x2c95, 3); return m.ret(6); }                                       // 2c8f bcs $2c95
          m.step(0x2c91, 2);
        }
      }
    }
    regs.y = regs.dec8(regs.y); m.step(0x2c92, 2);                                                   // 2c91 dey
    if (regs.fPl) { m.step(0x2c73, 3); continue; }                                                   // 2c92 bpl $2c73
    m.step(0x2c94, 2);
    regs.clc(); m.step(0x2c95, 2);                                                                   // 2c94 clc
    return m.ret(6);                                                                                 // 2c95 rts
  }
}
