// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1cc2  (ROM 0x1CC2–0x1CD1) — shared move tail. Store facing, bit0 -> sound 1d8f.
 */
export function loc_1cc2(m) {
  const { regs, mem } = m;
  regs.hl = 0x6207;
  m.step(0x1cc5, 10); // ld hl,0x6207
  mem.write8(regs.hl, regs.a);
  m.step(0x1cc6, 7); // ld (hl),a
  regs.rra(); // facing bit 0 -> carry
  m.step(0x1cc7, 4); // rra
  if (regs.fC) {
    m.push16(0x1cca);
    m.step(0x1d8f, 17); // call c,0x1d8f
    m.call(0x1d8f);
  } else {
    m.step(0x1cca, 10); // call c NOT taken
  }
  regs.a = 0x02;
  m.step(0x1ccc, 7); // ld a,0x02
  mem.write8(0x620f, regs.a);
  m.step(0x1ccf, 13); // ld (0x620f),a
  m.step(0x1da6, 10); // jp 0x1da6
  return m.call(0x1da6);
}
