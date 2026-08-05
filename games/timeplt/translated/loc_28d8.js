// SPDX-License-Identifier: GPL-3.0-only

// loc_28d8  (ROM 0x28D8–0x28E2)
export function loc_28d8(m) {
  const { regs } = m;

  regs.ix = 0xa880;
  m.step(0x28dc, 14); // ld ix,0xa880
  regs.iy = 0xaa20;
  m.step(0x28e0, 14); // ld iy,0xaa20
  m.step(0x290e, 10); // jp 0x290e

  return m.call(0x290e); // tail jump -- no return address pushed
}
