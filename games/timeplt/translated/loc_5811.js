// SPDX-License-Identifier: GPL-3.0-only

// loc_5811  (ROM 0x5811-0x5816, Time Pilot)
export function loc_5811(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x07a9);
  m.step(0x5814, 13); // ld a,(0x07a9)

  m.step(0x560c, 10); // jp 0x560c -- TAIL
  return m.call(0x560c);
}
