// SPDX-License-Identifier: GPL-3.0-only
// loc_a3d4  (ROM 0xa3d4-0xa3d5) -- stores A into $2c, then falls through into loc_a3d6.
export function loc_a3d4(m) {
  const { regs, mem } = m;
  mem.write8(0x2c, regs.a); m.step(0xa3d6, 3);
  return m.call(0xa3d6);
}
