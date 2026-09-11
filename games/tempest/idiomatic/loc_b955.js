// SPDX-License-Identifier: GPL-3.0-only

// Register-only leaf: always returns the constant pair A = 2, Y = 0, touching no memory.
export function loc_b955(m) {
  return [(m.regs.a = 0x02), (m.regs.y = 0x00)];
}
