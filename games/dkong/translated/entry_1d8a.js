// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_1d8a  (ROM 0x1D8A–0x1D8E) — SHARED animation-timer decrement tail.
 * Reached by jp/fall-through from entry_1d03 (0x1D7A jp z, 0x1D89 fall) and the
 * twin loc_1cf2 (0x1CF6 jp nz). NEVER called -- its `ret` returns to the
 * animation routine's caller. Decrements the 4-frame timer (0x620F).
 *   1d8a  ld hl,0x620f
 *   1d8d  dec (hl)
 *   1d8e  ret
 */
export function entry_1d8a(m) {
  const { regs, mem } = m;
  regs.hl = 0x620f;
  m.step(0x1d8d, 10); // ld hl,0x620f
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); // dec (hl) -- the BYTE, not the pointer
  m.step(0x1d8e, 11); // dec (hl) = 11 T
  m.ret(10); // 0x1D8E
}
