// SPDX-License-Identifier: GPL-3.0-only

// loc_28e3  (ROM 0x28e3-0x28ed, Time Pilot)
export function loc_28e3(m) {
  const { regs } = m;

  regs.ix = 0xa890;
  m.step(0x28e7, 14); // 28e3  ld ix,0xa890
  regs.iy = 0xaa22;
  m.step(0x28eb, 14); // 28e7  ld iy,0xaa22

  m.step(0x290e, 10);
  return m.call(0x290e);
}
