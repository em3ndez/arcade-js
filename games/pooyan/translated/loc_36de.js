// SPDX-License-Identifier: GPL-3.0-only

// loc_36de  (ROM 0x36de-0x3726) -- build an actor attribute byte (ix+0x08) via two rst-0x20 lookups.
// Index A = 2*(0x8820) + clamp(0x8907,0x0e) reads table 0x3737; the byte is decremented past the
// (ix+0x16)/(ix+0x13) flag gates and the (ix+0x06) phase gate, biased by 0x8901, then a second index
// reads table 0x3727 and is OR'd into (ix+0x08). rst 0x20 = loc_0020 (HL += A, A = (HL)).
export function loc_36de(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);          m.step(0x36e1, 13);
  regs.cp(0x10);                       m.step(0x36e3, 7);
  if (regs.fC) {
    m.step(0x36e7, 12);                                    // 36e3 jr c,0x36e7
  } else {
    m.step(0x36e5, 7);
    regs.a = 0x0e;                     m.step(0x36e7, 7);   // clamp 0x8907 to 0x0e
  }
  regs.b = regs.a;                     m.step(0x36e8, 4);
  regs.a = mem.read8(0x8820);          m.step(0x36eb, 13);
  regs.add(regs.a);                    m.step(0x36ec, 4);   // add a,a
  regs.add(regs.b);                    m.step(0x36ed, 4);   // add a,b
  regs.hl = 0x3737;                    m.step(0x36f0, 10);
  m.push16(0x36f1); m.step(0x0020, 11); m.call(0x0020);     // 36f0 rst 0x20: A = (0x3737+A)

  l3710: {
    l3703: {
      regs.bit(0, mem.read8((regs.ix + 0x16) & 0xffff)); m.step(0x36f5, 20);
      if (regs.fZ) { m.step(0x3703, 12); break l3703; }     // 36f5 jr z,0x3703
      m.step(0x36f7, 7);
      regs.a = regs.dec8(regs.a);      m.step(0x36f8, 4);
      if (regs.fZ) { m.step(0x3710, 12); break l3710; }     // 36f8 jr z,0x3710
      m.step(0x36fa, 7);
      regs.bit(0, mem.read8((regs.ix + 0x13) & 0xffff)); m.step(0x36fe, 20);
      if (regs.fZ) { m.step(0x3703, 12); break l3703; }     // 36fe jr z,0x3703
      m.step(0x3700, 7);
      regs.a = regs.dec8(regs.a);      m.step(0x3701, 4);
      if (regs.fZ) { m.step(0x3710, 12); break l3710; }     // 3701 jr z,0x3710
      m.step(0x3703, 7);                                    // fall through to 0x3703
    }
    // loc_3703: (ix+0x06) phase gate
    regs.b = regs.a;                   m.step(0x3704, 4);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3707, 19);
    regs.cp(0x09);                     m.step(0x3709, 7);
    regs.a = regs.b;                   m.step(0x370a, 4);   // cp only set flags; restore A
    if (regs.fNC) { m.step(0x3710, 12); break l3710; }      // 370a jr nc,0x3710
    m.step(0x370c, 7);
    regs.a = regs.dec8(regs.a);        m.step(0x370d, 4);
    if (regs.fZ) { m.step(0x3710, 12); break l3710; }       // 370d jr z,0x3710
    m.step(0x370f, 7);
    regs.a = regs.dec8(regs.a);        m.step(0x3710, 4);   // fall through to 0x3710
  }
  // loc_3710: 0x8901 bias
  regs.b = regs.a;                     m.step(0x3711, 4);
  regs.a = mem.read8(0x8901);          m.step(0x3714, 13);
  regs.cp(0x04);                       m.step(0x3716, 7);
  regs.a = regs.b;                     m.step(0x3717, 4);
  if (regs.fNC) {
    m.step(0x371c, 12);                                     // 3717 jr nc,0x371c
  } else {
    m.step(0x3719, 7);
    regs.a = 0x03;                     m.step(0x371b, 7);
    regs.add(regs.b);                  m.step(0x371c, 4);   // A = 3 + B
  }
  // loc_371c: second lookup + merge into (ix+0x08)
  regs.hl = 0x3727;                    m.step(0x371f, 10);
  m.push16(0x3720); m.step(0x0020, 11); m.call(0x0020);     // 371f rst 0x20: A = (0x3727+A)
  regs.or(mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x3723, 19);
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a); m.step(0x3726, 19);
  return m.ret(10);
}
