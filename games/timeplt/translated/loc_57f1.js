// SPDX-License-Identifier: GPL-3.0-only

// loc_57f1  (ROM 0x57F1-0x57F6, Time Pilot)
export function loc_57f1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x322e); // a ROM byte, not RAM -- holds 0x01
  m.step(0x57f4, 13); // ld a,(0x322e)

  m.step(0x5628, 10); // jp 0x5628 -- TAIL; its ret returns to OUR caller
  return m.call(0x5628);
}
