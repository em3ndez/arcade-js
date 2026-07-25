// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_144f  (ROM 0x144F–0x1457) — 141E interior: record 3 found -> player index 1, then loc_1459.
 */
export function loc_144f(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x1451, 7); // ld a,0x01
  mem.write8(0x600e, regs.a); // player index = 1
  m.step(0x1454, 13);
  mem.write8(0x600d, regs.a);
  m.step(0x1457, 13);
  regs.a = 0x00; // A = 0 for loc_1459 (differs from the state-1 path)
  m.step(0x1459, 7); // ld a,0x00
  return m.call(0x1459);
}
