// SPDX-License-Identifier: GPL-3.0-only

// loc_566e  (ROM 0x566E-0x5678, Time Pilot)
export function loc_566e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x07d8);
  m.step(0x5671, 13); // ld a,(0x07d8)
  m.push16(0x5674);
  m.step(0x560c, 17); // call 0x560c
  m.call(0x560c);

  regs.a = mem.read8(0x276b);
  m.step(0x5677, 13); // ld a,(0x276b)

  m.step(0x560c, 12); // jr 0x560c -- TAIL
  return m.call(0x560c);
}
