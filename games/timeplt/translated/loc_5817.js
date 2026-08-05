// SPDX-License-Identifier: GPL-3.0-only

// loc_5817  (ROM 0x5817-0x581C)
export function loc_5817(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x273a);
  m.step(0x581a, 13); // ld a,(0x273a) -- the sound code, 0x0B in the ROM image

  m.step(0x560c, 10); // jp 0x560c -- TAIL jump, nothing pushed
  return m.call(0x560c);
}
