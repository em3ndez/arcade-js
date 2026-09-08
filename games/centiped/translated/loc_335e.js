// SPDX-License-Identifier: GPL-3.0-only
// loc_335e (ROM 0x335e-0x3360) -- loads X = 0x02, then falls through to loc_3360.
export function loc_335e(m) {
  const { regs } = m;
  regs.x = 0x02; regs.setNZ(regs.x); m.step(0x3360, 2);  // 335e ldx #$02
  return m.call(0x3360);                                 // fall through into loc_3360
}
