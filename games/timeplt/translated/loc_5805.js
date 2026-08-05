// SPDX-License-Identifier: GPL-3.0-only

// loc_5805  (ROM 0x5805-0x580A, Time Pilot)
export function loc_5805(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2d4e); // a ROM byte, not RAM
  m.step(0x5808, 13); // ld a,(0x2d4e)

  m.step(0x560c, 10); // jp 0x560c -- tail-jump; its ret returns to OUR caller
  return m.call(0x560c);
}
