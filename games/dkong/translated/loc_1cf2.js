// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1cf2  (ROM 0x1CF2–0x1D02) — jump-phase handler. nonzero -> 0x1d8a; else jp 0x1d11.
 */
export function loc_1cf2(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x620f);
  m.step(0x1cf5, 13); // ld a,(0x620f)
  regs.and(regs.a);
  m.step(0x1cf6, 4); // and a
  if (regs.fNZ) { m.step(0x1d8a, 10); return m.call(0x1d8a); } // jp nz -- external
  m.step(0x1cf9, 5);
  regs.a = 0x03;
  m.step(0x1cfb, 7); // ld a,0x03
  mem.write8(0x620f, regs.a);
  m.step(0x1cfe, 13); // ld (0x620f),a
  regs.a = 0x02;
  m.step(0x1d00, 7); // ld a,0x02
  m.step(0x1d11, 10); // jp 0x1d11 -- external (extent boundary)
  return m.call(0x1d11);
}
