// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2e4b  (ROM 0x2E4B–0x2E69) — store the string pointer; at the 0xB7 boundary + terminator, set state 4 + sound.
 */
export function loc_2e4b(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x0e), regs.l);
  m.step(0x2e4e, 19); // ld (ix+0x0e),l
  mem.write8(R(0x0f), regs.h);
  m.step(0x2e51, 19); // ld (ix+0x0f),h
  regs.a = mem.read8(R(0x03));
  m.step(0x2e54, 19); // ld a,(ix+0x03)
  regs.cp(0xb7);
  m.step(0x2e56, 7); // cp 0xb7
  if (regs.fC) { m.step(0x2e6c, 10); return m.call(0x2e6c); } // jp c,0x2e6c (< 0xB7)
  m.step(0x2e59, 10);
  regs.a = regs.c;
  m.step(0x2e5a, 4); // ld a,c
  regs.cp(0x7f);
  m.step(0x2e5c, 7); // cp 0x7f
  if (regs.fNZ) { m.step(0x2e6c, 10); return m.call(0x2e6c); } // jp nz,0x2e6c
  m.step(0x2e5f, 10);
  mem.write8(R(0x0d), 0x04);
  m.step(0x2e63, 19); // ld (ix+0x0d),0x04 -- state = 4
  regs.xor(regs.a);
  m.step(0x2e64, 4); // xor a
  mem.write8(0x6083, regs.a);
  m.step(0x2e67, 13); // ld (0x6083),a
  regs.a = 0x03;
  m.step(0x2e69, 7); // ld a,0x03
  mem.write8(0x6084, regs.a);
  m.step(0x2e6c, 13); // ld (0x6084),a -- sound; falls into loc_2e6c
  return m.call(0x2e6c);
}
