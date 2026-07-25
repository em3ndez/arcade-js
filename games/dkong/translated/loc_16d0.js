// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_16d0  (ROM 0x16D0–0x16D2) — 0x62A0 = 1, then loc_16d5.
 */
export function loc_16d0(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x16d2, 7);
  mem.write8(0x62a0, regs.a);
  m.step(0x16d5, 13); // 0x62A0 = 1 -> loc_16d5
  return m.call(0x16d5);
}
