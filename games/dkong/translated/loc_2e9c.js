// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2e9c  (ROM 0x2E9C–0x2EA4) — 0x7F terminator: reset the string pointer to 0x39AA + sound; -> loc_2e4b.
 */
export function loc_2e9c(m) {
  const { regs, mem } = m;
  regs.hl = 0x39aa;
  m.step(0x2e9f, 10); // ld hl,0x39aa
  regs.a = 0x03;
  m.step(0x2ea1, 7); // ld a,0x03
  mem.write8(0x6083, regs.a);
  m.step(0x2ea4, 13); // ld (0x6083),a
  m.step(0x2e4b, 10); // jp 0x2e4b
  return m.call(0x2e4b);
}
