// SPDX-License-Identifier: GPL-3.0-only

// loc_0d6b  (ROM 0x0D6B–0x0D72)
export function loc_0d6b(m) {
  const { regs } = m;

  regs.de = 0xa641;
  m.step(0x0d6e, 10); // ld de,0xa641
  regs.hl = 0xa98d;
  m.step(0x0d71, 10); // ld hl,0xa98d
  regs.c = 0x10;
  m.step(0x0d73, 7); // ld c,0x10

  return m.call(0x0d73);
}
