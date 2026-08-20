// SPDX-License-Identifier: GPL-3.0-only

// loc_056b  (ROM 0x056b-0x059c) -- render one of three 3-byte BCD counters to a video column.
// The selector in A (0/1/2) picks the (source HL 0x88a4/0x88a7/0x88aa, dest IX 0x8781/0x8521/
// 0x8641) pair. For B=3 source bytes (HL descending) split each into high then low nibble
// (rrca x4 brings the high nibble down) and hand each to loc_059d, which stores the digit tile
// at (ix) and steps ix up by DE=-0x20. C (init 4) seeds loc_059d's leading-blank suppression.
export function loc_056b(m) {
  const { regs, mem } = m;

  regs.hl = 0x88a4;
  m.step(0x056e, 10); // 056b  ld hl,0x88a4
  regs.ix = 0x8781;
  m.step(0x0572, 14); // 056e  ld ix,0x8781
  regs.and(regs.a);
  m.step(0x0573, 4); // 0572  and a -- test selector
  if (regs.fZ) {
    m.step(0x0586, 12); // 0573  jr z,0x0586 (selector 0)
  } else {
    m.step(0x0575, 7); // 0573  jr z not taken
    regs.hl = 0x88a7;
    m.step(0x0578, 10); // 0575  ld hl,0x88a7
    regs.ix = 0x8521;
    m.step(0x057c, 14); // 0578  ld ix,0x8521
    regs.a = regs.dec8(regs.a);
    m.step(0x057d, 4); // 057c  dec a
    if (regs.fZ) {
      m.step(0x0586, 12); // 057d  jr z,0x0586 (selector 1)
    } else {
      m.step(0x057f, 7); // 057d  jr z not taken
      regs.hl = 0x88aa;
      m.step(0x0582, 10); // 057f  ld hl,0x88aa
      regs.ix = 0x8641;
      m.step(0x0586, 14); // 0582  ld ix,0x8641 (falls into 0x0586)
    }
  }

  regs.de = 0xffe0;
  m.step(0x0589, 10); // 0586  ld de,0xffe0 -- column step (-0x20)
  regs.b = 0x03;
  m.step(0x058b, 7); // 0589  ld b,0x03
  regs.c = 0x04;
  m.step(0x058d, 7); // 058b  ld c,0x04 -- blank budget

  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x058e, 7); // 058d  ld a,(hl)
    regs.rrca();
    m.step(0x058f, 4); // 058e  rrca
    regs.rrca();
    m.step(0x0590, 4); // 058f  rrca
    regs.rrca();
    m.step(0x0591, 4); // 0590  rrca
    regs.rrca();
    m.step(0x0592, 4); // 0591  rrca -- high nibble now in low
    m.push16(0x0595);
    m.step(0x059d, 17); // 0592  call 0x059d (pattern A: rets to 0x0595)
    m.call(0x059d);

    regs.a = mem.read8(regs.hl);
    m.step(0x0596, 7); // 0595  ld a,(hl) -- low nibble in place
    m.push16(0x0599);
    m.step(0x059d, 17); // 0596  call 0x059d (pattern A: rets to 0x0599)
    m.call(0x059d);

    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x059a, 6); // 0599  dec hl
    if (regs.djnz()) {
      m.step(0x058d, 13); // 059a  djnz 0x058d (taken)
    } else {
      m.step(0x059c, 8); // 059a  djnz not taken
      break;
    }
  } while (true);

  return m.ret(); // 059c  ret
}
