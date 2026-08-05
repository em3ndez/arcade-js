// SPDX-License-Identifier: GPL-3.0-only

// loc_2e31  (ROM 0x2E31–0x2E3D)
export function loc_2e31(m) {
  const { regs } = m;

  regs.b = regs.h;
  m.step(0x2e32, 4); // ld b,h
  regs.c = regs.l;
  m.step(0x2e33, 4); // ld c,l
  regs.b = regs.sra(regs.b);
  m.step(0x2e35, 8); // sra b
  regs.c = regs.rr(regs.c);
  m.step(0x2e37, 8); // rr c
  regs.b = regs.sra(regs.b);
  m.step(0x2e39, 8); // sra b
  regs.c = regs.rr(regs.c);
  m.step(0x2e3b, 8); // rr c
  regs.addHl(regs.bc);
  m.step(0x2e3c, 11); // add hl,bc
  regs.addHl(regs.de);
  m.step(0x2e3d, 11); // add hl,de

  m.ret(10); // ret (0x2E3D)
}
