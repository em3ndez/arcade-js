// SPDX-License-Identifier: GPL-3.0-only
// loc_dd29  (ROM 0xdd29-0xdd2a) -- ldx #$f8; falls through into loc_dd2b.
export function loc_dd29(m) {
  const { regs } = m;
  regs.x = 0xf8; regs.setNZ(regs.x); m.step(0xdd2b, 2);
  return m.call(0xdd2b);
}
