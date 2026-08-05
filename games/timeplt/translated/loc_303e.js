// SPDX-License-Identifier: GPL-3.0-only

// loc_303e  (ROM 0x303E–0x304C)
export function loc_303e(m) {
  const { regs } = m;

  regs.b = regs.h;
  m.step(0x303f, 4); // ld b,h
  regs.c = regs.l; // BC = HL
  m.step(0x3040, 4); // ld c,l

  regs.b = regs.sra(regs.b);
  m.step(0x3042, 8); // sra b
  regs.c = regs.rr(regs.c); // BC = HL >> 1, sign-preserving
  m.step(0x3044, 8); // rr c
  regs.b = regs.sra(regs.b);
  m.step(0x3046, 8); // sra b
  regs.c = regs.rr(regs.c); // BC = HL >> 2, sign-preserving
  m.step(0x3048, 8); // rr c

  regs.and(regs.a); // clears carry -- load-bearing for the sbc
  m.step(0x3049, 4); // and a
  regs.sbcHl(regs.bc); // HL -= HL >> 2  (sbcHl ASSIGNS hl; do not re-assign)
  m.step(0x304b, 15); // sbc hl,bc
  regs.addHl(regs.de);
  m.step(0x304c, 11); // add hl,de

  m.ret(10); // ret (0x304C)
}
