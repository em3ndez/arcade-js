// SPDX-License-Identifier: GPL-3.0-only
// loc_01c0  (ROM 0x01c0-0x01c2) -- called from 0x07e4/0x0a36/0x0b60. Seats HL=0x2100 then falls
// through into loc_01c3, the HL-relative 0x37-byte fill (which is also entered directly by
// `jmp 0x01c3` at 0x1907 with HL preset), so it delegates rather than inlining across the head.
export function loc_01c0(m) {
  const { regs } = m;

  regs.hl = 0x2100; m.step(0x01c3, 10); // 01c0  lxi h,0x2100
  return m.call(0x01c3); // fall through into loc_01c3
}
