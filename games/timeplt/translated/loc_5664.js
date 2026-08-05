// SPDX-License-Identifier: GPL-3.0-only

// loc_5664  (ROM 0x5664-0x5668, Time Pilot)
export function loc_5664(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x16de);
  m.step(0x5667, 13); // ld a,(0x16de)

  m.step(0x560c, 12); // jr 0x560c -- TAIL
  return m.call(0x560c);
}
