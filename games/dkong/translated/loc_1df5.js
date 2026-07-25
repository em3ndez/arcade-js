// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1df5  (ROM 0x1DF5–0x1DFF) — loc_1dc9 0x6342-bit2 tail: reads 0x6018, dispatches bits 0/1 to setter arms.
 */
export function loc_1df5(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6018);
  m.step(0x1df8, 13); // ld a,(0x6018)
  regs.rra();
  m.step(0x1df9, 4); // rra -- bit0
  if (regs.fC) { m.step(0x1e08, 10); return m.call(0x1e08); } // jp c,0x1e08
  m.step(0x1dfc, 10);
  regs.rra();
  m.step(0x1dfd, 4); // rra -- bit1
  if (regs.fC) { m.step(0x1e10, 10); return m.call(0x1e10); } // jp c,0x1e10
  m.step(0x1e00, 10); // -> loc_1e00
  return m.call(0x1e00);
}
