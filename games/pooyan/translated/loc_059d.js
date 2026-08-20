// SPDX-License-Identifier: GPL-3.0-only

// loc_059d  (ROM 0x059d-0x05b1) -- LEAF: render the digit in A's low nibble to the tile at (ix),
// then step ix by DE. A non-zero nibble is stored as-is and clears the blank budget C. A zero
// nibble stores blank tile 0x10 while C>0 (C--), or a real 0 once C hits 0. Ends in a plain ret.
export function loc_059d(m) {
  const { regs, mem } = m;

  regs.and(0x0f);
  m.step(0x059f, 7); // 059d  and 0x0f -- isolate low nibble
  if (regs.fZ) {
    m.step(0x05a9, 12); // 059f  jr z,0x05a9 (nibble zero)
    regs.a = regs.c;
    m.step(0x05aa, 4); // 05a9  ld a,c
    regs.and(regs.a);
    m.step(0x05ab, 4); // 05aa  and a -- test blank budget C
    if (regs.fNZ) {
      m.step(0x05ad, 7); // 05ab  jr z not taken (C != 0)
      regs.a = 0x10;
      m.step(0x05af, 7); // 05ad  ld a,0x10 -- blank tile
      regs.c = regs.dec8(regs.c);
      m.step(0x05b0, 4); // 05af  dec c
      m.step(0x05a3, 12); // 05b0  jr 0x05a3
    } else {
      m.step(0x05a3, 12); // 05ab  jr z,0x05a3 (C == 0 -> store real 0)
    }
  } else {
    m.step(0x05a1, 7); // 059f  jr z not taken (nibble non-zero)
    regs.c = 0x00;
    m.step(0x05a3, 7); // 05a1  ld c,0x00 -- a digit ends the leading-blank run
  }

  // 05a3 join: store the tile at (ix) and walk ix up the column by DE
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x05a6, 19); // 05a3  ld (ix+0x00),a
  regs.addIx(regs.de);
  m.step(0x05a8, 15); // 05a6  add ix,de
  return m.ret(); // 05a8  ret
}
