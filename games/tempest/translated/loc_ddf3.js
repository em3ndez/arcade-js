// SPDX-License-Identifier: GPL-3.0-only
// loc_ddf3  (ROM 0xddf3-0xddf6) -- mid-routine entry: ldy #$ff then bne (always taken, Y!=0) to loc_ddff.
export function loc_ddf3(m) {
  const { regs } = m;
  regs.y = 0xff; regs.setNZ(regs.y); m.step(0xddf5, 2);
  m.step(0xddff, 3); return m.call(0xddff);
}
