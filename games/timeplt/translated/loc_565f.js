// SPDX-License-Identifier: GPL-3.0-only

// loc_565f  (ROM 0x565F–0x5663)
export function loc_565f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x07a2);
  m.step(0x5662, 13); // ld a,(0x07a2)

  m.step(0x560c, 12); // jr 0x560c -- TAIL transfer
  return m.call(0x560c);
}
