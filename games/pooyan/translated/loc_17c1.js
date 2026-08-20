// SPDX-License-Identifier: GPL-3.0-only

// loc_17c1  (ROM 0x17c1-0x18ae) -- idx3 state handler (bird/enemy wave setup + spawn).
// Seeds four actor records at 0x8a80 (stride 0x18) with a start flag and two bytes pulled from a
// small ROM table selected by (0x8f50)/(0x8907) into (0x88be); optionally nudges (0x8a86) when
// (0x881f) is clear; sets the shared script cursor (0x8f00)=0x26c9 and steps the animators via
// loc_22b1. Then it branches on (0x8f50): the 0-branch either arms state 0x880a=0x12 or copies a
// terminated ROM string (0x183f, bytes-0x88) into 0x89f0; the nonzero-branch (block C) fans out a
// group of sprites at 0x8ae0 -- group size from (0x8907), tile pointer via loc_0c45(0x70eb),
// per-slot coord packing (H/C accumulate), and loc_381e to seat each slot's animation -- then
// finally sets state 0x880a=0x0f. Calls: 0x22b1 (in group), 0x0c45 + 0x381e (boundaries).
export function loc_17c1(m) {
  const { regs, mem } = m;

  regs.ix = 0x8a80;               m.step(0x17c5, 14);
  regs.a = mem.read8(0x8f50);     m.step(0x17c8, 13);
  regs.and(regs.a);               m.step(0x17c9, 4);
  regs.de = 0x84f6;               m.step(0x17cc, 10);
  if (regs.fNZ) {
    m.step(0x17d8, 12);                    // jr nz taken -- 0x8f50 set
    regs.hl = 0x1e34;             m.step(0x17db, 10);
    regs.e = 0xe9;                m.step(0x17dd, 7);
  } else {
    m.step(0x17ce, 7);                     // jr nz not taken
    regs.a = mem.read8(0x8907);   m.step(0x17d1, 13);
    regs.bit(0, regs.a);          m.step(0x17d3, 8);
    regs.hl = 0x1e2c;             m.step(0x17d6, 10);
    if (regs.fNZ) {
      m.step(0x17dd, 12);                  // jr nz taken -- keep HL=0x1e2c, DE=0x84f6
    } else {
      m.step(0x17d8, 7);                   // jr nz not taken
      regs.hl = 0x1e34;           m.step(0x17db, 10);
      regs.e = 0xe9;              m.step(0x17dd, 7);
    }
  }

  // loc_17dd: publish the selected table pointer, then seed 4 records from ROM (HL) into 0x8a80+
  mem.write16(0x88be, regs.de);   m.step(0x17e1, 20);
  regs.de = 0x0018;               m.step(0x17e4, 10);
  regs.b = 0x04;                  m.step(0x17e6, 7);
  for (;;) { // loc_17e6
    mem.write8((regs.ix + 0x00) & 0xffff, 0x01);   m.step(0x17ea, 19);
    regs.a = mem.read8(regs.hl);                   m.step(0x17eb, 7);
    mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x17ee, 19);
    regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x17ef, 6);
    regs.a = mem.read8(regs.hl);                   m.step(0x17f0, 7);
    mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x17f3, 19);
    regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x17f4, 6);
    regs.addIx(regs.de);                           m.step(0x17f6, 15);
    if (regs.djnz()) { m.step(0x17e6, 13); continue; }
    m.step(0x17f8, 8); break;
  }

  regs.ix = 0x8a80;               m.step(0x17fc, 14);
  regs.a = mem.read8(0x881f);     m.step(0x17ff, 13);
  regs.and(regs.a);               m.step(0x1800, 4);
  if (regs.fNZ) {
    m.step(0x1808, 12);                    // jr nz taken -- skip the nudge
  } else {
    m.step(0x1802, 7);                     // jr nz not taken
    regs.decMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x1805, 23);
    regs.decMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x1808, 23);
  }

  // loc_1808: seat the shared script cursor and run the animators
  regs.hl = 0x26c9;               m.step(0x180b, 10);
  mem.write16(0x8f00, regs.hl);   m.step(0x180e, 16);
  m.push16(0x1811);
  m.step(0x22b1, 17);             // 180e  call 0x22b1
  m.call(0x22b1);

  regs.a = mem.read8(0x8f50);     m.step(0x1814, 13);
  regs.and(regs.a);               m.step(0x1815, 4);
  if (regs.fZ) {
    // loc_1817: (0x8f50)==0 branch -- state arm / string copy
    m.step(0x1817, 7);                     // jr nz not taken
    regs.a = mem.read8(0x8806);   m.step(0x181a, 13);
    regs.and(regs.a);             m.step(0x181b, 4);
    if (regs.fZ) {
      m.step(0x181d, 7);                   // jr nz not taken
      regs.a = mem.read8(0x8f3f); m.step(0x1820, 13);
      regs.and(regs.a);           m.step(0x1821, 4);
      if (regs.fNZ) {
        m.step(0x1823, 7);                 // jr z not taken -- arm state 0x12
        regs.hl = 0x880a;         m.step(0x1826, 10);
        mem.write8(regs.hl, 0x12); m.step(0x1828, 10);
        return m.ret(10);
      }
      m.step(0x1829, 12);                  // jr z taken
    } else {
      m.step(0x1829, 12);                  // jr nz taken
    }

    // loc_1829: bump state and copy the terminated ROM string (0x183f) into 0x89f0
    regs.hl = 0x880a;             m.step(0x182c, 10);
    regs.incMem8(mem, regs.hl);   m.step(0x182d, 11);
    regs.de = 0x183f;             m.step(0x1830, 10);
    regs.hl = 0x89f0;             m.step(0x1833, 10);
    for (;;) { // loc_1833
      regs.a = mem.read8(regs.de);        m.step(0x1834, 7);
      regs.cp(0x43);                      m.step(0x1836, 7);
      if (regs.fZ) { return m.ret(11); }  // ret z -- 'C' terminator
      m.step(0x1837, 5);
      regs.sub(0x88);                     m.step(0x1839, 7);
      mem.write8(regs.hl, regs.a);        m.step(0x183a, 7);
      regs.de = (regs.de + 1) & 0xffff;   m.step(0x183b, 6);
      regs.hl = (regs.hl + 1) & 0xffff;   m.step(0x183c, 6);
      m.step(0x1833, 12);                 // jr 0x1833
    }
  }

  // loc_1848: block C -- (0x8f50) nonzero: fan out the sprite group at 0x8ae0
  m.step(0x1848, 12);                     // jr nz taken
  regs.a = mem.read8(0x8907);     m.step(0x184b, 13);
  regs.bit(1, regs.a);            m.step(0x184d, 8);
  if (regs.fNZ) {
    m.step(0x184f, 7);                     // jr z not taken -- build the group
    regs.a = mem.read8(0x8907);   m.step(0x1852, 13);
    regs.a = regs.srl(regs.a);    m.step(0x1854, 8);
    regs.cp(0x07);                m.step(0x1856, 7);
    if (regs.fC) {
      m.step(0x185e, 12);                  // jr c taken -- count < 7
      regs.a = regs.srl(regs.a);  m.step(0x1860, 8);
      regs.and(0x03);             m.step(0x1862, 7);
      regs.b = regs.a;            m.step(0x1863, 4);
      regs.add(0x05);             m.step(0x1865, 7);
    } else {
      m.step(0x1858, 7);                   // jr c not taken -- saturate at 8
      regs.a = 0x08;              m.step(0x185a, 7);
      regs.b = 0x03;              m.step(0x185c, 7);
      m.step(0x1865, 12);                  // jr 0x1865
    }

    // loc_1865: group size in (0x8f47); look up the tile-base word via loc_0c45(A=B, HL=0x70eb)
    mem.write8(0x8f47, regs.a);   m.step(0x1868, 13);
    regs.a = regs.b;              m.step(0x1869, 4);
    regs.hl = 0x70eb;             m.step(0x186c, 10);
    m.push16(0x186f);
    m.step(0x0c45, 17);           // 186c  call 0x0c45 (DE <- tile-base word)
    m.call(0x0c45);
    regs.exDeHl();                m.step(0x1870, 4); // HL = tile-base word
    regs.ix = 0x8ae0;             m.step(0x1874, 14);
    regs.a = mem.read8(0x8f47);   m.step(0x1877, 13);
    regs.b = regs.a;              m.step(0x1878, 4);
    regs.c = 0x00;                m.step(0x187a, 7);
    for (;;) { // loc_187a: seat one sprite slot
      mem.write8((regs.ix + 0x05) & 0xffff, 0x80); m.step(0x187e, 19);
      mem.write8((regs.ix + 0x00) & 0xffff, 0x01); m.step(0x1882, 19);
      mem.write8((regs.ix + 0x06) & 0xffff, 0x04); m.step(0x1886, 19);
      mem.write8((regs.ix + 0x04) & 0xffff, regs.h); m.step(0x1889, 19);
      regs.a = regs.l;            m.step(0x188a, 4);
      regs.and(0x0f);             m.step(0x188c, 7);
      regs.add(regs.h);           m.step(0x188d, 4);
      regs.h = regs.a;            m.step(0x188e, 4);
      regs.a = regs.l;            m.step(0x188f, 4);
      regs.and(0xf0);             m.step(0x1891, 7);
      regs.add(regs.c);           m.step(0x1892, 4);
      regs.c = regs.a;            m.step(0x1893, 4);
      mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x1896, 19);
      if (regs.fNC) {
        m.step(0x189c, 12);                // jr nc taken
      } else {
        m.step(0x1898, 7);                 // jr nc not taken -- carry into the tile high byte
        regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x189b, 23);
        regs.h = regs.inc8(regs.h);        m.step(0x189c, 4);
      }
      regs.de = 0x3829;           m.step(0x189f, 10);
      m.push16(0x18a2);
      m.step(0x381e, 17);         // 189f  call 0x381e (seat this slot's animation)
      m.call(0x381e);
      regs.de = 0x0018;           m.step(0x18a5, 10);
      regs.addIx(regs.de);        m.step(0x18a7, 15);
      if (regs.djnz()) { m.step(0x187a, 13); continue; }
      m.step(0x18a9, 8); break;
    }
  } else {
    m.step(0x18a9, 12);                    // jr z taken -- bit1 clear, skip the group build
  }

  // loc_18a9: leave state = 0x0f
  regs.hl = 0x880a;               m.step(0x18ac, 10);
  mem.write8(regs.hl, 0x0f);      m.step(0x18ae, 10);
  return m.ret(10);
}
