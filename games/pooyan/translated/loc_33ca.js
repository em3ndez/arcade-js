// SPDX-License-Identifier: GPL-3.0-only

// loc_33ca  (ROM 0x33ca-0x33f4) -- second entry point into loc_33bd's tail (call target from
// loc_33bd at 0x3407; loc_33bd also falls through into this same code). Re-emits the reachable
// span from 0x33ca: a rst 0x20 (0x3418 byte table) lookup latched at 0x8d4b, then a branch on the
// masked column vs (ix+0x06)/(ix+0x05) that either stores (ix+0x08) and starts the turn animation
// (jp loc_381e) or defers to loc_3473. The frozen layer duplicates the shared tail per entry point.
export function loc_33ca(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d43);                         m.step(0x33cd, 13);
  regs.and(0x0f);                                     m.step(0x33cf, 7);
  regs.hl = 0x3418;                                   m.step(0x33d2, 10);
  m.push16(0x33d3); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = table[0x3418+A]
  mem.write8(0x8d4b, regs.a);                         m.step(0x33d6, 13); // ld (0x8d4b),a
  regs.cp(mem.read8((regs.ix + 0x06) & 0xffff));      m.step(0x33d9, 19); // cp (ix+0x06)
  if (regs.fZ) {
    m.step(0x33ec, 12);                              // jr z,0x33ec
    regs.a = mem.read8((regs.ix + 0x09) & 0xffff);   m.step(0x33ef, 19);
    regs.cp(mem.read8((regs.ix + 0x05) & 0xffff));   m.step(0x33f2, 19); // cp (ix+0x05)
    if (regs.fC) {
      m.step(0x33e3, 12);                            // jr c,0x33e3 (back-branch into the tail)
      regs.de = 0x3838;                              m.step(0x33e6, 10);
    } else {
      m.step(0x33f4, 7);                             // jr c not taken
      m.step(0x3473, 10); return m.call(0x3473);     // jp 0x3473 (TAIL)
    }
  } else {
    m.step(0x33db, 7);                               // jr z not taken
    regs.a = 0x00;                                   m.step(0x33dd, 7);
    regs.de = 0x3829;                                m.step(0x33e0, 10);
    if (regs.fNC) {
      m.step(0x33e6, 12);                            // jr nc,0x33e6
    } else {
      m.step(0x33e2, 7);                             // jr nc not taken
      regs.a = regs.inc8(regs.a);                    m.step(0x33e3, 4); // inc a
      regs.de = 0x3838;                              m.step(0x33e6, 10);
    }
  }
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a);     m.step(0x33e9, 19); // ld (ix+0x08),a
  m.step(0x381e, 10); return m.call(0x381e);         // jp 0x381e (TAIL)
}
