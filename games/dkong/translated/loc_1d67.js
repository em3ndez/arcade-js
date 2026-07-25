// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d67  (ROM 0x1D67–0x1D73) — limit-reached: sprite-control:= 6, clear 0x6219/0x6215, tail-jump entry_1da6.
 */
export function loc_1d67(m) {
  const { regs, mem } = m;
  regs.a = 0x06;
  m.step(0x1d69, 7); // ld a,0x06
  mem.write8(0x6207, regs.a);
  m.step(0x1d6c, 13); // ld (0x6207),a := 6
  regs.xor(regs.a);
  m.step(0x1d6d, 4); // xor a
  mem.write8(0x6219, regs.a);
  m.step(0x1d70, 13); // ld (0x6219),a := 0
  mem.write8(0x6215, regs.a);
  m.step(0x1d73, 13); // ld (0x6215),a := 0  (NOTE: 0, vs 1 at loc_1d49)
  m.step(0x1da6, 10); // jp 0x1da6 (TAIL JUMP)
  return m.call(0x1da6);
}
