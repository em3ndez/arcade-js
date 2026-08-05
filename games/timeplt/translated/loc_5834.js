// SPDX-License-Identifier: GPL-3.0-only

// loc_5834  (ROM 0x5834-0x5839)
export function loc_5834(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x1767);
  m.step(0x5837, 13); // ld a,(0x1767) -- the sound code
  m.step(0x560c, 10); // jp 0x560c -- tail-jump
  return m.call(0x560c);
}
