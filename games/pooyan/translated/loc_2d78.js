// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2d78  (ROM 0x2d78-0x2d7b) -- dispatch on (0x8f14) via rst 0x28 into the inline table at 0x2d7c
// {0->0x2d80, 1->0x2dbc}. The handler ret's to loc_2d78's caller (loc_2d66).
export function loc_2d78(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f14); m.step(0x2d7b, 13); // 2d78  ld a,(0x8f14)
  m.push16(0x2d7c); m.step(0x0028, 11); // 2d7b  rst 0x28 (table base 0x2d7c)
  return m.call(0x0028);
}
