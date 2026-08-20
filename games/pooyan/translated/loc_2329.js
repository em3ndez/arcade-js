// SPDX-License-Identifier: GPL-3.0-only

// loc_2329  (ROM 0x2329-0x23d6) -- bidirectional position driver for the object at IX. Bit 2 of
// (ix+7) selects the rise path (dec (ix+4), clamp low to 0x41); bit 3 selects the descent path
// (inc (ix+4), clamp high to 0xc0). After moving (loc_23d7/loc_2405) it may step the ring counter
// at 0x88bd (mod 8 rising, mod 8 falling), and on wrap it recomputes (0x88bd)&3 and re-renders the
// three status fields via loc_3325 (with the pointer/lookup pair loc_0c45). No move -> early ret.
export function loc_2329(m) {
  const { regs, mem } = m;

  regs.bit(2, mem.read8((regs.ix + 0x07) & 0xffff), ((regs.ix + 0x07) >> 8) & 0xff);
  m.step(0x232d, 20);

  if (regs.fZ) {
    // ===== descent path (0x236a): gated on bit 3, inc (ix+4) clamped to 0xc0 =====
    m.step(0x236a, 12); // jr z,0x236a
    regs.bit(3, mem.read8((regs.ix + 0x07) & 0xffff), ((regs.ix + 0x07) >> 8) & 0xff);
    m.step(0x236e, 20);
    if (regs.fZ) { return m.ret(11); } // 236e ret z -- bit 3 clear, no descent
    m.step(0x236f, 5);
    regs.incMem8(mem, (regs.ix + 0x04) & 0xffff);  m.step(0x2372, 23);
    regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x2375, 19);
    regs.cp(0xc0);                                 m.step(0x2377, 7);
    if (regs.fC) {
      m.step(0x237d, 12); // jr c taken (a < 0xc0)
    } else {
      m.step(0x2379, 7);  // jr c not taken -- clamp
      mem.write8((regs.ix + 0x04) & 0xffff, 0xc0); m.step(0x237d, 19);
    }
    m.push16(0x2380); m.step(0x23d7, 17); m.call(0x23d7); // 237d call 0x23d7
    regs.a = mem.read8(0x88be);   m.step(0x2383, 13);
    regs.cp(0xf6);                m.step(0x2385, 7);
    joinB: {
      if (regs.fNZ) { m.step(0x239e, 12); break joinB; } // 2385 jr nz,0x239e
      m.step(0x2387, 7);
      regs.hl = 0x8a38;           m.step(0x238a, 10);
      regs.b = 0x03;              m.step(0x238c, 7);
      for (;;) { // 238c
        regs.a = mem.read8(regs.hl); m.step(0x238d, 7);
        regs.and(regs.a);            m.step(0x238e, 4);
        if (regs.fNZ) { m.step(0x239e, 12); break joinB; } // 238e jr nz,0x239e
        m.step(0x2390, 7);
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2391, 6);
        if (regs.djnz()) { m.step(0x238c, 13); } else { m.step(0x2393, 8); break; }
      }
      regs.hl = 0x8083;           m.step(0x2396, 10);
      regs.a = mem.read8(0x8343); m.step(0x2399, 13);
      regs.add(mem.read8(regs.hl)); m.step(0x239a, 7);
      regs.and(0x0f);             m.step(0x239c, 7);
      regs.and(regs.a);           m.step(0x239d, 4);
      if (regs.fZ) { return m.ret(11); } // 239d ret z
      m.step(0x239e, 5);
    }
    // loc_239e: advance the falling ring counter
    m.push16(0x23a1); m.step(0x2405, 17); m.call(0x2405); // 239e call 0x2405
    regs.hl = 0x88bd;            m.step(0x23a4, 10);
    regs.decMem8(mem, regs.hl);  m.step(0x23a5, 11);
    regs.a = mem.read8(regs.hl); m.step(0x23a6, 7);
    regs.and(0x07);              m.step(0x23a8, 7);
    mem.write8(regs.hl, regs.a); m.step(0x23a9, 7);
    regs.and(regs.a);            m.step(0x23aa, 4);
    if (regs.fNZ) { return m.ret(11); } // 23aa ret nz -- no wrap
    m.step(0x23ab, 5);
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x23ac, 6);
    regs.decMem8(mem, regs.hl);       m.step(0x23ad, 11);
    // fall through to the shared render tail
  } else {
    // ===== rise path (0x232f): bit 2 set, dec (ix+4) clamped to 0x41 =====
    m.step(0x232f, 7); // jr z not taken
    regs.decMem8(mem, (regs.ix + 0x04) & 0xffff);  m.step(0x2332, 23);
    regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x2335, 19);
    regs.cp(0x41);                                 m.step(0x2337, 7);
    if (regs.fNC) {
      m.step(0x233d, 12); // jr nc taken (a >= 0x41)
    } else {
      m.step(0x2339, 7);  // jr nc not taken -- clamp
      mem.write8((regs.ix + 0x04) & 0xffff, 0x41); m.step(0x233d, 19);
    }
    m.push16(0x2340); m.step(0x23d7, 17); m.call(0x23d7); // 233d call 0x23d7
    regs.hl = mem.read16(0x88be); m.step(0x2343, 16);
    regs.a = regs.l;              m.step(0x2344, 4);
    regs.cp(0xe6);                m.step(0x2346, 7);
    joinA: {
      if (regs.fNZ) { m.step(0x2359, 12); break joinA; } // 2346 jr nz,0x2359
      m.step(0x2348, 7);
      regs.a = mem.read8(regs.hl); m.step(0x2349, 7);
      regs.cp(0x35);               m.step(0x234b, 7);
      if (regs.fNC) { m.step(0x2359, 12); break joinA; } // 234b jr nc,0x2359
      m.step(0x234d, 7);
      regs.h = 0x89;               m.step(0x234f, 7);
      regs.b = 0x07;               m.step(0x2351, 7);
      for (;;) { // 2351
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2352, 6);
        regs.a = mem.read8(regs.hl);      m.step(0x2353, 7);
        regs.or(regs.a);                  m.step(0x2354, 4);
        if (regs.fNZ) { m.step(0x2359, 12); break joinA; } // 2354 jr nz,0x2359
        m.step(0x2356, 7);
        if (regs.djnz()) { m.step(0x2351, 13); } else { m.step(0x2358, 8); return m.ret(10); } // 2358 ret
      }
    }
    // loc_2359: advance the rising ring counter
    m.push16(0x235c); m.step(0x23ec, 17); m.call(0x23ec); // 2359 call 0x23ec
    regs.hl = 0x88bd;            m.step(0x235f, 10);
    regs.incMem8(mem, regs.hl);  m.step(0x2360, 11);
    regs.a = mem.read8(regs.hl); m.step(0x2361, 7);
    regs.and(0x07);              m.step(0x2363, 7);
    mem.write8(regs.hl, regs.a); m.step(0x2364, 7);
    regs.and(regs.a);            m.step(0x2365, 4);
    if (regs.fNZ) { return m.ret(11); } // 2365 ret nz -- no wrap
    m.step(0x2366, 5);
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x2367, 6);
    regs.incMem8(mem, regs.hl);       m.step(0x2368, 11);
    m.step(0x23ad, 12); // 2368 jr 0x23ad
    // fall through to the shared render tail
  }

  // ===== shared render tail (0x23ad): recompute (0x88bc)&3, re-render three fields =====
  regs.a = mem.read8(regs.hl); m.step(0x23ae, 7); // 23ad ld a,(hl)  (HL = 0x88bc)
  regs.and(0x03);              m.step(0x23b0, 7);
  mem.write8(regs.hl, regs.a); m.step(0x23b1, 7);
  regs.hl = 0x26f6;            m.step(0x23b4, 10);
  m.push16(0x23b7); m.step(0x0c45, 17); m.call(0x0c45); // 23b4 call 0x0c45 (-> DE)
  m.push16(regs.de);          m.step(0x23b8, 11);  // 23b7 push de
  regs.hl = 0x8425;           m.step(0x23bb, 10);
  m.push16(0x23be); m.step(0x3325, 17); m.call(0x3325); // 23bb call 0x3325
  regs.de = m.pop16();        m.step(0x23bf, 10);  // 23be pop de
  regs.l = 0x65;              m.step(0x23c1, 7);
  m.push16(0x23c4); m.step(0x3325, 17); m.call(0x3325); // 23c1 call 0x3325
  regs.l = 0xa5;              m.step(0x23c6, 7);
  regs.de = 0x270a;           m.step(0x23c9, 10);
  regs.a = mem.read8(0x88bc); m.step(0x23cc, 13);
  regs.and(0x01);             m.step(0x23ce, 7);
  if (regs.fNZ) {
    m.step(0x23d3, 12); // 23ce jr nz,0x23d3
  } else {
    m.step(0x23d0, 7);
    regs.de = 0x270e;         m.step(0x23d3, 10);
  }
  m.push16(0x23d6); m.step(0x3325, 17); m.call(0x3325); // 23d3 call 0x3325
  return m.ret(10); // 23d6 ret
}
