// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c4b  (ROM 0x2C4B–0x2C4E) — ROM 0x2C4B entry (from entry_2c7b jp 0x2c4b): stores caller's A.
 *  at 0x6382, then 0x638f = A+1 (inc a BETWEEN the two stores, draft TEST 1).
 */
export function loc_2c4b(m) {
  const { regs, mem } = m;
  mem.write8(0x6382, regs.a); // ld (0x6382),a
  m.step(0x2c4e, 13); // ld (0x6382),a
  regs.a = regs.inc8(regs.a); // inc a -- BETWEEN the two stores
  m.step(0x2c4f, 4); // inc a
  return m.call(0x2c4f);
}
