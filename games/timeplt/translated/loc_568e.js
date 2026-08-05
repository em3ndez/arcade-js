// SPDX-License-Identifier: GPL-3.0-only

// loc_568e  (ROM 0x568E-0x5693, Time Pilot)
export function loc_568e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2d87);
  m.step(0x5691, 13); // ld a,(0x2d87)

  m.step(0x560c, 10); // jp 0x560c -- TAIL
  return m.call(0x560c);
}
