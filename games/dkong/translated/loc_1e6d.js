// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e6d  (ROM 0x1E6D–0x1E77) — 1E57 interior: set 0x694D mirror flag by carry, then unwind.
 */
export function loc_1e6d(m) {
  const { regs, mem } = m;
  regs.a = 0x00;
  m.step(0x1e6f, 7); // ld a,0x00
  if (regs.fC) {
    m.step(0x1e74, 10); // jp c -- keep A=0
  } else {
    m.step(0x1e72, 10); // jp c not taken
    regs.a = 0x80;
    m.step(0x1e74, 7); // ld a,0x80
  }
  mem.write8(0x694d, regs.a); // sprite mirror flag
  m.step(0x1e77, 13);
  m.step(0x1e85, 10); // jp 0x1e85 -- the unwind
  return m.call(0x1e85);
}
