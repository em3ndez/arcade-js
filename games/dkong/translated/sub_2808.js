// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2808  (ROM 0x2808–0x281C).
 */
export function sub_2808(m) {
  const { regs, mem } = m;

  regs.iy = 0x6200;
  m.step(0x280c, 14); // ld iy,0x6200
  regs.a = mem.read8(0x6205);
  m.step(0x280f, 13); // ld a,(0x6205)
  regs.c = regs.a;
  m.step(0x2810, 4); // ld c,a
  regs.hl = 0x0407;
  m.step(0x2813, 10); // ld hl,0x0407
  m.push16(0x2816);
  m.step(0x286f, 17); // call 0x286f -- returns A
  m.call(0x286f);

  regs.and(regs.a);
  m.step(0x2817, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z
    return;
  }
  m.step(0x2818, 5); // ret z NOT taken
  regs.a = regs.dec8(regs.a);
  m.step(0x2819, 4); // dec a
  mem.write8(0x6200, regs.a); // 0x6200 = A - 1
  m.step(0x281c, 13); // ld (0x6200),a
  m.ret(); // ret (0x281C)
}
