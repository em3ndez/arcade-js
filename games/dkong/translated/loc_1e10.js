// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e10  (ROM 0x1E10–0x1E14) — setter B=0x7F, DE=0x0008; falls into loc_1e15.
 */
export function loc_1e10(m) {
  const { regs } = m;
  regs.b = 0x7f;
  m.step(0x1e12, 7); // ld b,0x7f
  regs.de = 0x0008;
  m.step(0x1e15, 10); // ld de,0x0008
  return m.call(0x1e15);
}
