// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d83  (ROM 0x2D83–0x2D89) — wrap the string pointer to 0x39CC, re-enter loc_2d54.
 */
export function loc_2d83(m) {
  const { regs, mem } = m;
  regs.hl = 0x39cc;
  m.step(0x2d86, 10); // ld hl,0x39cc
  mem.write16(0x62a8, regs.hl);
  m.step(0x2d89, 16); // ld (0x62a8),hl
  m.step(0x2d54, 10); // jp 0x2d54
  return m.call(0x2d54);
}
