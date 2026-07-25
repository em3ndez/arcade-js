// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_04f9  (ROM 0x04F9–0x0506) — blink OFF: clear bit7 of (0x6901) and (0x6905); back to loc_04ac (jp nc from 0x050E).
 */
export function loc_04f9(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6901);
  m.step(0x04fc, 13); // ld a,(0x6901)
  regs.and(0x7f);
  m.step(0x04fe, 7); // and 0x7f
  mem.write8(0x6901, regs.a);
  m.step(0x0501, 13); // ld (0x6901),a
  regs.a = mem.read8(0x6905);
  m.step(0x0504, 13); // ld a,(0x6905)
  regs.and(0x7f);
  m.step(0x0506, 7); // and 0x7f
  m.step(0x04ac, 10); // jp 0x04ac (BACKWARD rejoin)
  return m.call(0x04ac);
}
