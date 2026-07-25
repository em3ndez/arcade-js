// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e08  (ROM 0x1E08–0x1E0F) — setter B=0x7E, DE=0x0005; jp loc_1e15.
 */
export function loc_1e08(m) {
  const { regs } = m;
  regs.b = 0x7e;
  m.step(0x1e0a, 7); // ld b,0x7e
  regs.de = 0x0005;
  m.step(0x1e0d, 10); // ld de,0x0005
  m.step(0x1e15, 10); // jp 0x1e15
  return m.call(0x1e15);
}
