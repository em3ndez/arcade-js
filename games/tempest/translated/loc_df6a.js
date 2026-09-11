// SPDX-License-Identifier: GPL-3.0-only
// loc_df6a  (ROM 0xdf6a-0xdf6b) -- Y=0, fall into loc_df6c (the $70-header variant).
export function loc_df6a(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf6c, 2);
  return m.call(0xdf6c);
}
