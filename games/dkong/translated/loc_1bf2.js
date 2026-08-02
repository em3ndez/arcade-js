// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1bf2  (ROM 0x1BF2–0x1C04) — D-nonzero branch of loc_1bb2.
 */
export function loc_1bf2(m, X) {
  const { regs, mem } = m;
  regs.e = regs.dec8(regs.e);
  m.step(0x1bf3, 4); // dec e
  if (regs.fNZ) { m.step(0x1c05, 10); return m.call(0x1c05, X); } // jp nz
  m.step(0x1bf6, 5);
  mem.write8(X(0x10), 0xff);
  m.step(0x1bfa, 19); // ld (ix+0x10),0xff
  mem.write8(X(0x11), 0x80);
  m.step(0x1bfe, 19); // ld (ix+0x11),0x80
  mem.write8(X(0x07), regs.res(7, mem.read8(X(0x07))));
  m.step(0x1c02, 23); // res 7,(ix+0x07)
  m.step(0x1bd8, 10); // jp 0x1bd8
  return m.call(0x1bd8, X);
}
