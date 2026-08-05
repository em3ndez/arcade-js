// SPDX-License-Identifier: GPL-3.0-only

// loc_304d  (ROM 0x304D–0x3057)
export function loc_304d(m) {
  const { regs } = m;

  regs.b = regs.h;
  m.step(0x304e, 4); // ld b,h
  regs.c = regs.l;
  m.step(0x304f, 4); // ld c,l
  regs.b = regs.sra(regs.b);
  m.step(0x3051, 8); // sra b -- carry = the bit leaving B
  regs.c = regs.rr(regs.c);
  m.step(0x3053, 8); // rr c -- that bit becomes C's bit 7
  regs.and(regs.a); // clears carry for the sbc
  m.step(0x3054, 4); // and a
  regs.sbcHl(regs.bc);
  m.step(0x3056, 15); // sbc hl,bc
  regs.addHl(regs.de);
  m.step(0x3057, 11); // add hl,de

  m.ret(); // 0x3057
}
