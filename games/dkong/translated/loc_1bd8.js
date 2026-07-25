// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1bd8  (ROM 0x1BD8–0x1BF1) — landing target via 2407, gravity via 239c.
 */
export function loc_1bd8(m, X) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6220);
  m.step(0x1bdb, 13); // ld a,(0x6220)
  regs.a = regs.dec8(regs.a);
  m.step(0x1bdc, 4); // dec a
  if (regs.fZ) { m.step(0x1bec, 10); return m.call(0x1bec, X); } // jp z
  m.step(0x1bdf, 5);
  m.push16(0x1be2);
  m.step(0x2407, 17); // call 0x2407
  m.call(0x2407); // returns HL (fixed-point)
  mem.write8(X(0x12), regs.h);
  m.step(0x1be5, 19); // ld (ix+0x12),h
  mem.write8(X(0x13), regs.l);
  m.step(0x1be8, 19); // ld (ix+0x13),l
  mem.write8(X(0x14), 0x00);
  m.step(0x1bec, 19); // ld (ix+0x14),0x00
  return m.call(0x1bec, X);
}
