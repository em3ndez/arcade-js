// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d51  (ROM 0x2D51–0x2D51) — load the string pointer (0x62A8), fall into loc_2d54.
 */
export function loc_2d51(m) {
  const { regs, mem } = m;
  regs.hl = mem.read16(0x62a8);
  m.step(0x2d54, 16); // ld hl,(0x62a8)
  return m.call(0x2d54);
}
