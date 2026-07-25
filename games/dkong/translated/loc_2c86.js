// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c86  (ROM 0x2C86–0x2C8C) — ROM 0x2C86 entry (from entry_2c03 @ 0x2C20 and entry_2c41 @ 0x2C46).
 */
export function loc_2c86(m) {
  const { regs, mem } = m;
  regs.xor(regs.a); // xor a -- A = 0 (CLEARS 0x6382, NOT entry_2c72's set-bit-7)
  m.step(0x2c87, 4); // xor a
  mem.write8(0x6382, regs.a); // ld (0x6382),a -- (0x6382) := 0 (draft TEST 2)
  m.step(0x2c8a, 13); // ld (0x6382),a
  regs.a = 0x03;
  m.step(0x2c8c, 7); // ld a,0x03
  m.step(0x2c4f, 10); // jp 0x2c4f -- A = 0x03 into loc_2c4f
  return m.call(0x2c4f);
}
