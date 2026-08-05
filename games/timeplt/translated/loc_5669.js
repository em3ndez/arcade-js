// SPDX-License-Identifier: GPL-3.0-only

// loc_5669  (ROM 0x5669-0x566D, Time Pilot)
export function loc_5669(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x4c9f); // ROM constant
  m.step(0x566c, 13); // ld a,(0x4c9f)

  m.step(0x560c, 12); // jr 0x560c -- TAIL
  return m.call(0x560c);
}
