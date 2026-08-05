// SPDX-License-Identifier: GPL-3.0-only

// loc_580b  (ROM 0x580B-0x5810, Time Pilot)
export function loc_580b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x49ee);
  m.step(0x580e, 13); // ld a,(0x49ee)

  m.step(0x560c, 10); // jp 0x560c -- TAIL
  return m.call(0x560c);
}
