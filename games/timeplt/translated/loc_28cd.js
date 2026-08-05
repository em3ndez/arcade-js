// SPDX-License-Identifier: GPL-3.0-only

// loc_28cd  (ROM 0x28cd-0x28d7, Time Pilot)
export function loc_28cd(m) {
  const { regs } = m;

  regs.ix = 0xa870;
  m.step(0x28d1, 14); // 28cd  ld ix,0xa870
  regs.iy = 0xaa1e;
  m.step(0x28d5, 14); // 28d1  ld iy,0xaa1e

  m.step(0x290e, 10);
  return m.call(0x290e);
}
