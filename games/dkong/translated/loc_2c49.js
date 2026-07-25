// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c49  (ROM 0x2C49–0x2C49) — ROM 0x2C49 entry (from entry_2c7b jp z,0x2c49): A:= 0x01.
 */
export function loc_2c49(m) {
  const { regs } = m;
  regs.a = 0x01;
  m.step(0x2c4b, 7); // ld a,0x01
  return m.call(0x2c4b);
}
