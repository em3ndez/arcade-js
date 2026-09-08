// SPDX-License-Identifier: GPL-3.0-only
// loc_39ea (ROM 0x39ea-0x3a08) -- shifts A's top two bits as a selector: zero Y, or bound Y near 0xfa then DEY, or bound Y near 0x06 then INY; A is shifted once more on the DEY path
export function loc_39ea(m) {
  const { regs, mem } = m;
  regs.a = regs.asl(regs.a); m.step(0x39eb, 2);                                        // 39ea asl a
  if (regs.fNC) {
    m.step(0x39f3, 3);                                                                 // 39eb bcc $39f3 (taken)
    regs.cpy(0xfa); m.step(0x39f5, 2);                                                 // 39f3 cpy #$fa
    if (regs.fZ) {
      m.step(0x39fc, 3);                                                               // 39f5 beq $39fc (taken)
    } else {
      m.step(0x39f7, 2);                                                               // 39f5 beq $39fc (not taken)
      if (regs.fC) {
        m.step(0x39fb, 3);                                                             // 39f7 bcs $39fb (taken)
      } else {
        m.step(0x39f9, 2);                                                             // 39f7 bcs $39fb (not taken)
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x39fb, 2);                          // 39f9 ldy #$00
      }
      regs.y = regs.dec8(regs.y); m.step(0x39fc, 2);                                   // 39fb dey
    }
    regs.a = regs.asl(regs.a); m.step(0x39fd, 2);                                      // 39fc asl a
    return m.ret(6);                                                                   // 39fd rts
  }
  m.step(0x39ed, 2);                                                                   // 39eb bcc $39f3 (not taken)
  regs.a = regs.asl(regs.a); m.step(0x39ee, 2);                                        // 39ed asl a
  if (regs.fNC) {
    m.step(0x39fe, 3);                                                                 // 39ee bcc $39fe (taken)
    regs.cpy(0x06); m.step(0x3a00, 2);                                                 // 39fe cpy #$06
    if (regs.fZ) {
      m.step(0x3a07, 3);                                                               // 3a00 beq $3a07 (taken)
    } else {
      m.step(0x3a02, 2);                                                               // 3a00 beq $3a07 (not taken)
      if (regs.fNC) {
        m.step(0x3a06, 3);                                                             // 3a02 bcc $3a06 (taken)
      } else {
        m.step(0x3a04, 2);                                                             // 3a02 bcc $3a06 (not taken)
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3a06, 2);                          // 3a04 ldy #$00
      }
      regs.y = regs.inc8(regs.y); m.step(0x3a07, 2);                                   // 3a06 iny
    }
    return m.ret(6);                                                                   // 3a07 rts
  }
  m.step(0x39f0, 2);                                                                   // 39ee bcc $39fe (not taken)
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x39f2, 2);                                // 39f0 ldy #$00
  return m.ret(6);                                                                     // 39f2 rts
}
