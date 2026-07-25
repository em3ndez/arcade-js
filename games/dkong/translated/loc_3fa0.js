// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3fa0  (ROM 0x3FA0–0x3FA5) — calls 0x3FA6, then tail-jumps to loc_0d5f.
 *
 *   3fa0  cd a6 3f     call 0x3fa6
 *   3fa3  c3 5f 0d     jp   0x0d5f
 *
 * A call then a tail jump, so 0x0D5F's eventual `ret` returns to whoever
 * called into 0x3FA0 -- which is loc_0cc6's caller, not loc_0cc6.
 */
export function loc_3fa0(m) {
  m.push16(0x3fa3);
  m.step(0x3fa6, 17);
  m.call(0x3fa6);
  m.step(0x0d5f, 10); // jp -- TAIL jump
  m.call(0x0d5f);
}
