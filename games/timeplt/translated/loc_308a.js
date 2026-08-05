// SPDX-License-Identifier: GPL-3.0-only

// loc_308a  (ROM 0x308A–0x30A4)
export function loc_308a(m) {
  const { regs, mem } = m;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.b = mem.read8(Y(0x31));
  m.step(0x308d, 19); // ld b,(iy+0x31)
  regs.c = mem.read8(Y(0x00));
  m.step(0x3090, 19); // ld c,(iy+0x00)
  regs.h = 0xf0;
  m.step(0x3092, 7); // ld h,0xf0
  regs.l = 0x10;
  m.step(0x3094, 7); // ld l,0x10
  regs.addHl(regs.bc);
  m.step(0x3095, 11); // add hl,bc
  mem.write8(Y(0x33), regs.h);
  m.step(0x3098, 19); // ld (iy+0x33),h
  mem.write8(Y(0x02), regs.l);
  m.step(0x309b, 19); // ld (iy+0x02),l

  return m.call(0x309b);
}
