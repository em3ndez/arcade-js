// SPDX-License-Identifier: GPL-3.0-only

// loc_57f7  (ROM 0x57F7-0x57FE, Time Pilot)
export function loc_57f7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x57fa, 13); // ld a,(0xad04)
  regs.add(0x0c);
  m.step(0x57fc, 7); // add a,0x0c

  m.step(0x560c, 10); // jp 0x560c -- TAIL
  return m.call(0x560c);
}
