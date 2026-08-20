// SPDX-License-Identifier: GPL-3.0-only

// loc_5835  (ROM 0x5835-0x585a) -- eagle spawn / step entry. If the eagle-active flag (0x8d4a) is
// already set, tail-jumps to loc_57c6 to step the existing eagle. Otherwise it marks the eagle
// active, seeds the sprite fields (ix+0x0b / ix+0x13=3 / ix+0x16 / ix+0x07=2), points its animation
// sequence via loc_381e (DE=0x3847), then sets up the row-checksum walk (HL=0x0bb5, B=0x52, D=0)
// and falls through into loc_585b.
export function loc_5835(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d4a);       m.step(0x5838, 13);
  regs.and(regs.a);                 m.step(0x5839, 4);
  if (regs.fNZ) {
    m.step(0x57c6, 12);             // jr nz,0x57c6 (tail -- step the active eagle)
    return m.call(0x57c6);
  }
  m.step(0x583b, 7);                // jr nz not taken -- spawn a new eagle

  regs.a = 0x01;                    m.step(0x583d, 7);
  mem.write8(0x8d4a, regs.a);       m.step(0x5840, 13);
  mem.write8((regs.ix + 0x0b) & 0xffff, regs.a); m.step(0x5843, 19);
  mem.write8((regs.ix + 0x13) & 0xffff, 0x03);   m.step(0x5847, 19);
  mem.write8((regs.ix + 0x16) & 0xffff, regs.a); m.step(0x584a, 19);
  mem.write8((regs.ix + 0x07) & 0xffff, 0x02);   m.step(0x584e, 19);
  regs.de = 0x3847;                 m.step(0x5851, 10);
  m.push16(0x5854);
  m.step(0x381e, 17);               // 5851  call 0x381e (set animation-sequence pointer)
  m.call(0x381e);
  regs.hl = 0x0bb5;                 m.step(0x5857, 10);
  regs.b = 0x52;                    m.step(0x5859, 7);
  regs.xor(regs.a);                 m.step(0x585a, 4); // xor a -> A=0
  regs.d = regs.a;                  m.step(0x585b, 4); // ld d,a -- falls through to loc_585b
  return m.call(0x585b);
}
