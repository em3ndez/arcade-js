// SPDX-License-Identifier: GPL-3.0-only

// loc_583a  (ROM 0x583A-0x583F, Time Pilot)
export function loc_583a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x18fa);
  m.step(0x583d, 13); // ld a,(0x18fa)

  m.step(0x560c, 10); // jp 0x560c -- TAIL
  return m.call(0x560c);
}
