// SPDX-License-Identifier: GPL-3.0-only

// loc_33bd  (ROM 0x33bd-0x3416) -- enemy actor state-0 handler. Counts down the timer (ix+0x11);
// on expiry advances the frame (ix+0x02) and, when bit0 of (ix+0x0b) is set, runs the 0x33f7
// flap-reset arm (bump 0x8d4c, latch 0x8901=6, clear 0x8d4a / (ix+0x0b), re-run the tail via
// loc_33ca). Otherwise it falls into the loc_33ca tail (rst 0x20 0x3418-table lookup) that starts
// the turn animation (jp loc_381e) or defers to loc_3473 -- mirrored by second entry loc_33ca.
export function loc_33bd(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);      m.step(0x33c0, 23); // dec (ix+0x11)
  if (regs.fNZ) { return m.ret(11); }                // ret nz
  m.step(0x33c1, 5);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);      m.step(0x33c4, 23); // inc (ix+0x02)
  regs.bit(0, mem.read8((regs.ix + 0x0b) & 0xffff)); m.step(0x33c8, 20); // bit 0,(ix+0x0b)
  if (regs.fNZ) {
    // loc_33f7: flap-reset arm (bit0 set) -- re-run the tail then pick the 0x3847/0x3856 sprite table
    m.step(0x33f7, 12);                              // jr nz,0x33f7
    regs.hl = 0x8d4c;                                m.step(0x33fa, 10);
    regs.incMem8(mem, regs.hl);                      m.step(0x33fb, 11); // inc (0x8d4c)
    regs.a = 0x06;                                   m.step(0x33fd, 7);
    mem.write8(0x8901, regs.a);                      m.step(0x3400, 13); // ld (0x8901),a
    regs.xor(regs.a);                                m.step(0x3401, 4);  // xor a
    mem.write8(0x8d4a, regs.a);                      m.step(0x3404, 13); // ld (0x8d4a),a
    mem.write8((regs.ix + 0x0b) & 0xffff, regs.a);   m.step(0x3407, 19); // ld (ix+0x0b),a
    m.push16(0x340a); m.step(0x33ca, 17); m.call(0x33ca); // call loc_33ca
    regs.de = 0x3847;                                m.step(0x340d, 10);
    regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x3411, 20); // bit 0,(ix+0x08)
    if (regs.fZ) {
      m.step(0x33e9, 12);                            // jr z,0x33e9
    } else {
      m.step(0x3413, 7);                             // jr z not taken
      regs.de = 0x3856;                              m.step(0x3416, 10);
      m.step(0x33e9, 12);                            // jr 0x33e9
    }
    m.step(0x381e, 10); return m.call(0x381e);       // jp 0x381e (TAIL)
  }
  m.step(0x33ca, 7);                                 // jr nz not taken -> loc_33ca tail

  // loc_33ca: rst 0x20 (0x3418 byte table) -> 0x8d4b; branch on the masked column vs (ix+0x06)
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
