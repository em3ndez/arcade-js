// SPDX-License-Identifier: GPL-3.0-only

// loc_2e19  (ROM 0x2E19-0x2E30) — jumps to 0x49A8, which owns the rest.
export function loc_2e19(m) {
  const { regs, mem } = m;

  mem.write8(0xa9c1, regs.a);
  m.step(0x2e1c, 13); // ld (0xa9c1),a
  regs.a = regs.c;
  m.step(0x2e1d, 4); // ld a,c
  regs.rrca();
  m.step(0x2e1e, 4); // rrca
  regs.rrca();
  m.step(0x2e1f, 4); // rrca
  regs.c = regs.a;
  m.step(0x2e20, 4); // ld c,a -- keep the rolling remainder
  regs.and(0x01);
  m.step(0x2e22, 7); // and 0x01
  mem.write8(0xa9c2, regs.a);
  m.step(0x2e25, 13); // ld (0xa9c2),a
  regs.a = regs.c;
  m.step(0x2e26, 4); // ld a,c
  regs.rrca();
  m.step(0x2e27, 4); // rrca
  regs.c = regs.a;
  m.step(0x2e28, 4); // ld c,a
  regs.and(0x01);
  m.step(0x2e2a, 7); // and 0x01
  mem.write8(0xa9c3, regs.a);
  m.step(0x2e2d, 13); // ld (0xa9c3),a
  regs.a = regs.c;
  m.step(0x2e2e, 4); // ld a,c

  m.step(0x49a8, 10); // jp 0x49a8 -- into patch space, same routine

  return m.call(0x49a8);
}
