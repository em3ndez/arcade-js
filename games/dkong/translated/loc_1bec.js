// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1bec  (ROM 0x1BEC–0x1BF1) — gravity via 239c, then jp into the 1c05 dispatch.
 */
export function loc_1bec(m, X) {
  m.push16(0x1bef);
  m.step(0x239c, 17); // call 0x239c
  m.call(0x239c);
  m.step(0x1c05, 10); // jp 0x1c05
  return m.call(0x1c05, X);
}
