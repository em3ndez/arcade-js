// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d49  (ROM 0x1D49–0x1D4E) — mark the sprite dirty (0x6215:=1), tail-jump entry_1da6.
 */
export function loc_1d49(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x1d4b, 7); // ld a,0x01
  mem.write8(0x6215, regs.a);
  m.step(0x1d4e, 13); // ld (0x6215),a := 1
  m.step(0x1da6, 10); // jp 0x1da6 (TAIL JUMP)
  return m.call(0x1da6); // 1da6's ret returns to entry_1d03's caller
}
