// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1bb2  (ROM 0x1BB2–0x1BF1) — AIRBORNE (0x6216==1). Sets IX=0x6200 (its OWN regime).
 */
export function loc_1bb2(m) {
  const { regs, mem } = m;
  regs.ix = 0x6200; // this path's IX (do NOT share R with the spine)
  m.step(0x1bb6, 14); // ld ix,0x6200
  const X = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(0x6203);
  m.step(0x1bb9, 13); // ld a,(0x6203)
  mem.write8(X(0x0b), regs.a);
  m.step(0x1bbc, 19); // ld (ix+0x0b),a
  regs.a = mem.read8(0x6205);
  m.step(0x1bbf, 13); // ld a,(0x6205)
  mem.write8(X(0x0c), regs.a);
  m.step(0x1bc2, 19); // ld (ix+0x0c),a
  m.push16(0x1bc5);
  m.step(0x239c, 17); // call 0x239c
  m.call(0x239c);
  m.push16(0x1bc8);
  m.step(0x241f, 17); // call 0x241f
  m.call(0x241f); // returns (D,E)
  regs.d = regs.dec8(regs.d);
  m.step(0x1bc9, 4); // dec d
  if (regs.fNZ) { m.step(0x1bf2, 10); return m.call(0x1bf2, X); } // jp nz
  m.step(0x1bcc, 5);
  mem.write8(X(0x10), 0x00);
  m.step(0x1bd0, 19); // ld (ix+0x10),0x00
  mem.write8(X(0x11), 0x80);
  m.step(0x1bd4, 19); // ld (ix+0x11),0x80
  mem.write8(X(0x07), regs.set(7, mem.read8(X(0x07))));
  m.step(0x1bd8, 23); // set 7,(ix+0x07)
  return m.call(0x1bd8, X);
}
