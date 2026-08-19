// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2778  (ROM 0x2778-0x277d) -- per-frame driver for the 0x8f30 state machine (arrow/rope launch
// sequence), called from 0x2101. Dispatches (0x8f30)&7 via rst 0x28 into the inline table at 0x277e:
// {0->0x278f, 1->0x27f3, 2->0x2856, 3->0x28ad, 4->0x28c5}. The handler ret's to loc_2778's caller.
export function loc_2778(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f30); m.step(0x277b, 13); // 2778  ld a,(0x8f30)
  regs.and(0x07); m.step(0x277d, 7); // 277b  and 0x07
  m.push16(0x277e); m.step(0x0028, 11); // 277d  rst 0x28 (table base 0x277e)
  return m.call(0x0028);
}
