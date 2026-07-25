// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_127c  (ROM 0x127C–0x127E) — 0x0748 table entry 4: sub_1dbd then dispatch.
 *
 *   127c  cd bd 1d     call 0x1dbd
 *   (falls through into entry_127f)
 */
export function loc_127c(m) {
  m.push16(0x127f);
  m.step(0x1dbd, 17); // call 0x1dbd
  m.call(0x1dbd);
  return m.call(0x127f); // fall through -- entry_127f's dispatch tail returns for us
}
