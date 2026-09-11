// SPDX-License-Identifier: GPL-3.0-only
// loc_df73  (ROM 0xdf73-0xdf74) -- store Y into $73, falls through into loc_df75.
export function loc_df73(m) {
  const { regs, mem } = m;
  mem.write8(0x0073, regs.y); m.step(0xdf75, 3);
  return m.call(0xdf75);
}
