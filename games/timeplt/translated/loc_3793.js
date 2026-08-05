// SPDX-License-Identifier: GPL-3.0-only

// loc_3793  (ROM 0x3793-0x379E, Time Pilot)
export function loc_3793(m) {
  const { regs } = m;

  regs.b = 0x05;
  m.step(0x3795, 7); // ld b,0x05 -- five records
  regs.ix = 0xa890;
  m.step(0x3799, 14); // ld ix,0xa890
  regs.iy = 0xaa22;
  m.step(0x379d, 14); // ld iy,0xaa22

  m.step(0x37d6, 12); // jr 0x37d6 -- TAIL jump, nothing pushed
  return m.call(0x37d6);
}
