// SPDX-License-Identifier: GPL-3.0-only

// loc_57ff  (ROM 0x57FF-0x5804, Time Pilot)
export function loc_57ff(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x079b); // a ROM byte, not RAM
  m.step(0x5802, 13); // ld a,(0x079b)

  m.step(0x560c, 10); // jp 0x560c -- tail-jump; its ret returns to OUR caller
  return m.call(0x560c);
}
