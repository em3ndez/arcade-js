// SPDX-License-Identifier: GPL-3.0-only
// loc_3aa7 (ROM 0x3aa7-0x3ac0) -- stores A to the 0x1600,X cell, pulses the 0x1680 register with 8/9/8/0, then loads A from the 0x1700,X cell
export function loc_3aa7(m) {
  const { regs, mem } = m;
  mem.write8((0x1600 + regs.x) & 0xffff, regs.a); m.step(0x3aaa, 5);                   // 3aa7 sta $1600,x
  regs.y = 0x08; regs.setNZ(regs.y); m.step(0x3aac, 2);                                // 3aaa ldy #$08
  mem.write8(0x1680, regs.y); m.step(0x3aaf, 4);                                       // 3aac sty $1680
  regs.y = regs.inc8(regs.y); m.step(0x3ab0, 2);                                       // 3aaf iny
  mem.write8(0x1680, regs.y); m.step(0x3ab3, 4);                                       // 3ab0 sty $1680
  regs.y = regs.dec8(regs.y); m.step(0x3ab4, 2);                                       // 3ab3 dey
  mem.write8(0x1680, regs.y); m.step(0x3ab7, 4);                                       // 3ab4 sty $1680
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3ab9, 2);                                // 3ab7 ldy #$00
  regs.a = mem.read8((0x1700 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x3abc, 4); // 3ab9 lda $1700,x
  mem.write8(0x1680, regs.y); m.step(0x3abf, 4);                                       // 3abc sty $1680
  return m.ret(6);                                                                     // 3abf rts
}
