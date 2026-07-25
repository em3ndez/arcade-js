// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_04e1  (ROM 0x04E1–0x04EE) — blink ON: set bit7 of (0x6901) and (0x6905); back to loc_04ac (jp from 0x0511).
 */
export function loc_04e1(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6901);
  m.step(0x04e4, 13); // ld a,(0x6901)
  regs.or(0x80);
  m.step(0x04e6, 7); // or 0x80
  mem.write8(0x6901, regs.a);
  m.step(0x04e9, 13); // ld (0x6901),a
  regs.a = mem.read8(0x6905);
  m.step(0x04ec, 13); // ld a,(0x6905)
  regs.or(0x80);
  m.step(0x04ee, 7); // or 0x80
  m.step(0x04ac, 10); // jp 0x04ac (BACKWARD rejoin)
  return m.call(0x04ac);
}
