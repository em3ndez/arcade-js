// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_04a1  (ROM 0x04A1–0x04A1) — A = 0x10, then fall into loc_04a3.
 */
export function loc_04a1(m) {
  const { regs } = m;
  regs.a = 0x10;
  m.step(0x04a3, 7); // ld a,0x10 -- falls into 0x04a3
  return m.call(0x04a3);
}
