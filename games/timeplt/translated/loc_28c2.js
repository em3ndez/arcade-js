// SPDX-License-Identifier: GPL-3.0-only

// loc_28c2  (ROM 0x28C2-0x28CC, Time Pilot)
export function loc_28c2(m) {
  const { regs } = m;

  regs.ix = 0xa860;
  m.step(0x28c6, 14); // ld ix,0xa860

  regs.iy = 0xaa1c;
  m.step(0x28ca, 14); // ld iy,0xaa1c

  m.step(0x290e, 10);
  return m.call(0x290e);
}
