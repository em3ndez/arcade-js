// SPDX-License-Identifier: GPL-3.0-only

// loc_5679  (ROM 0x5679-0x567D)
export function loc_5679(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x07fe);
  m.step(0x567c, 13); // ld a,(0x07fe) -- the sound command, 0x86
  m.step(0x560c, 12); // jr 0x560c -- TAIL jump, nothing pushed
  return m.call(0x560c);
}
