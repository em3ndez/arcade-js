// SPDX-License-Identifier: GPL-3.0-only

// loc_28b7  (ROM 0x28B7–0x28C1)
export function loc_28b7(m) {
  const { regs } = m;

  regs.ix = 0xa850;
  m.step(0x28bb, 14); // ld ix,0xa850
  regs.iy = 0xaa1a;
  m.step(0x28bf, 14); // ld iy,0xaa1a

  m.step(0x290e, 10);
  return m.call(0x290e);
}
