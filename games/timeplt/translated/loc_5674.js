// SPDX-License-Identifier: GPL-3.0-only

// loc_5674  (ROM 0x5674-0x5678, Time Pilot)
export function loc_5674(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x276b);
  m.step(0x5677, 13); // ld a,(0x276b)

  m.step(0x560c, 12); // jr 0x560c -- TAIL
  return m.call(0x560c);
}
