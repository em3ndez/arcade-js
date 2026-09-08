// SPDX-License-Identifier: GPL-3.0-only
// loc_21c7  (ROM 0x21c7-0x2201) -- picks $81 (2 or 1 by $ab,X vs the $fd/$a9,X compare), optionally
// remaps it through loc_382d when $100a bit2 is set, stores it to $51, and seeds $71/$61/$41/$a1/$b5.
export function loc_21c7(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x21c9, 3);                     // 21c7 ldx $88
  regs.y = 0x02; regs.setNZ(regs.y); m.step(0x21cb, 2);                                  // 21c9 ldy #$02
  regs.a = mem.read8((0x00ab + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x21cd, 4);   // 21cb lda $ab,x
  if (regs.fNZ) {                                                                        // 21cd bne $21db
    m.step(0x21db, 3);
  } else {
    m.step(0x21cf, 2);
    regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x21d1, 3);                   // 21cf lda $fd
    regs.and(0x40); m.step(0x21d3, 2);                                                   // 21d1 and #$40
    regs.ora(0x10); m.step(0x21d5, 2);                                                   // 21d3 ora #$10
    regs.cmp(mem.read8((0x00a9 + regs.x) & 0xff)); m.step(0x21d7, 4);                    // 21d5 cmp $a9,x
    if (regs.fNC) {                                                                      // 21d7 bcc $21db
      m.step(0x21db, 3);
    } else {
      m.step(0x21d9, 2);
      regs.y = 0x01; regs.setNZ(regs.y); m.step(0x21db, 2);                             // 21d9 ldy #$01
    }
  }
  mem.write8(0x0081, regs.y); m.step(0x21dd, 3);                                         // 21db sty $81
  regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x21e0, 4);                     // 21dd lda $100a
  regs.and(0x04); m.step(0x21e2, 2);                                                     // 21e0 and #$04
  if (regs.fNZ) {                                                                        // 21e2 beq $21e9
    m.step(0x21e4, 2);
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0x21e5, 2);                             // 21e4 tya
    m.step(0x21e8, 6); m.call(0x382d);                                                   // 21e5 jsr $382d
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0x21e9, 2);                             // 21e8 tay
  } else {
    m.step(0x21e9, 3);
  }
  mem.write8(0x0051, regs.y); m.step(0x21eb, 3);                                         // 21e9 sty $51
  regs.a = 0x60; regs.setNZ(regs.a); m.step(0x21ed, 2);
  regs.eor(mem.read8(0x00f0)); m.step(0x21ef, 3);                                        // 21ed eor $f0
  mem.write8(0x0071, regs.a); m.step(0x21f1, 3);                                         // 21ef sta $71
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x21f3, 2);
  mem.write8(0x0061, regs.a); m.step(0x21f5, 3);                                         // 21f3 sta $61
  regs.a = 0xf8; regs.setNZ(regs.a); m.step(0x21f7, 2);
  mem.write8(0x0041, regs.a); m.step(0x21f9, 3);                                         // 21f7 sta $41
  regs.a = 0x60; regs.setNZ(regs.a); m.step(0x21fb, 2);
  mem.write8(0x00a1, regs.a); m.step(0x21fd, 3);                                         // 21fb sta $a1
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x21ff, 2);
  mem.write8(0x00b5, regs.a); m.step(0x2201, 3);                                         // 21ff sta $b5
  return m.ret(6);                                                                       // 2201 rts
}
