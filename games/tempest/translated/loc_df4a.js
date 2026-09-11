// SPDX-License-Identifier: GPL-3.0-only
// loc_df4a  (ROM 0xdf4a-0xdf4b) -- ldy $73; falls through into loc_df4c.
export function loc_df4a(m) {
  const { regs, mem } = m;
  regs.y = mem.read8(0x0073); regs.setNZ(regs.y); m.step(0xdf4c, 3);
  return m.call(0xdf4c);
}
