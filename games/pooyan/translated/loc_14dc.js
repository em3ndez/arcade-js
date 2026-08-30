// SPDX-License-Identifier: GPL-3.0-only

// loc_14dc  (ROM 0x14dc-0x1554) -- object state handler spanning several sub-states of one IX
// record. Preamble: B=1, C=(ix+0x17); if (0x8d45)==0 OR (ix+0x12)==0xff, jump straight to the
// setup at 0x1508 (leaving C = (ix+0x17) or (ix+0x12)+1, B=1). Otherwise clamp A=(0x8d45) to
// max 4, build the bitmask 1<<(A-1) (via the sla/djnz loop at 0x14fa), OR it into the flags byte
// at 0x8f60, bump the counter at 0x8f5e, and set B=0x38.
//   Setup 0x1508: (ix+0x11)=B (a frame/timer count), A=C, then call 0x0c45 (table at 0x1557 via
// HL) and 0x381e, advance the sub-state (inc (ix+0x02)).
//   0x1518: call 0x4006 (per-frame service); dec (ix+0x11); while non-zero `ret nz` back to the
// caller (still counting down). When it hits zero, read/double the 0x8f60 flags; if non-zero
// resolve a target via 0x1131 (E), optionally stash A at 0x85e9, then 0x1119 (0x85c9 list).
//   0x153a: if (ix+0x16)==0x07 tail-jp 0x3d99; else bump it into (ix+0x13), set (ix+0x11)=1,
// advance the sub-state again.
//   0x154d: call 0x4006, dec (ix+0x11), `ret nz`; when it reaches zero tail-jp 0x3553.
// Calls (all plain-ret pattern-A): 0x0c45, 0x381e, 0x4006, 0x1131, 0x1119. Tail jumps: 0x3d99,
// 0x3553. push16/pop16 balance on every path (SP returns to the caller baseline).
export function loc_14dc(m) {
  const { regs, mem } = m;

  regs.b = 0x01;                                       m.step(0x14de, 7);
  regs.c = mem.read8((regs.ix + 0x17) & 0xffff);       m.step(0x14e1, 19);
  regs.a = mem.read8(0x8d45);                          m.step(0x14e4, 13);
  regs.and(regs.a);                                    m.step(0x14e5, 4);

  if (regs.fZ) {
    m.step(0x1508, 12); // 14e5  jr z,0x1508 (taken -- attract/idle: skip the mask build)
  } else {
    m.step(0x14e7, 7);
    regs.c = mem.read8((regs.ix + 0x12) & 0xffff);     m.step(0x14ea, 19);
    regs.c = regs.inc8(regs.c);                        m.step(0x14eb, 4);

    if (regs.fZ) {
      m.step(0x1508, 12); // 14eb  jr z,0x1508 (taken -- (ix+0x12) was 0xff)
    } else {
      m.step(0x14ed, 7);
      regs.cp(0x05);                                   m.step(0x14ef, 7);
      if (regs.fC) {
        m.step(0x14f3, 12);
      } else {
        m.step(0x14f1, 7);
        regs.a = 0x04;                                 m.step(0x14f3, 7);  // 14f1  ld a,0x04 (clamp)
      }

      // loc_14f3
      regs.b = regs.a;                                 m.step(0x14f4, 4);
      regs.b = regs.dec8(regs.b);                      m.step(0x14f5, 4);
      regs.c = regs.b;                                 m.step(0x14f6, 4);

      if (regs.fZ) {
        m.step(0x14fe, 12); // 14f6  jr z,0x14fe (taken -- A==1: mask stays 1)
      } else {
        m.step(0x14f8, 7);
        regs.a = 0x01;                                 m.step(0x14fa, 7);

        // loc_14fa: A <<= 1, (A-1) times  ->  mask = 1 << (A-1)
        for (;;) {
          regs.a = regs.sla(regs.a);                   m.step(0x14fc, 8);
          if (regs.djnz() !== 0) { m.step(0x14fa, 13); continue; }
          m.step(0x14fe, 8);
          break;
        }
      }

      // loc_14fe
      regs.hl = 0x8f60;                                m.step(0x1501, 10);
      regs.add(mem.read8(regs.hl));                    m.step(0x1502, 7);
      mem.write8(regs.hl, regs.a);                     m.step(0x1503, 7);
      regs.l = 0x5e;                                   m.step(0x1505, 7);
      mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); m.step(0x1506, 11);
      regs.b = 0x38;                                   m.step(0x1508, 7);
    }
  }

  // loc_1508
  mem.write8((regs.ix + 0x11) & 0xffff, regs.b);       m.step(0x150b, 19);
  regs.a = regs.c;                                     m.step(0x150c, 4);
  regs.hl = 0x1557;                                    m.step(0x150f, 10);
  m.push16(0x1512);                                    m.step(0x0c45, 17);
  m.call(0x0c45);
  m.push16(0x1515);                                    m.step(0x381e, 17);
  m.call(0x381e);
  mem.write8((regs.ix + 0x02) & 0xffff, regs.inc8(mem.read8((regs.ix + 0x02) & 0xffff)));
  m.step(0x1518, 23);

  // loc_1518
  m.push16(0x151b);                                    m.step(0x4006, 17);
  m.call(0x4006);
  mem.write8((regs.ix + 0x11) & 0xffff, regs.dec8(mem.read8((regs.ix + 0x11) & 0xffff)));
  m.step(0x151e, 23);
  if (regs.fNZ) {
    return m.ret(11);
  }
  m.step(0x151f, 5);

  regs.a = mem.read8(0x8f60);                          m.step(0x1522, 13);
  regs.a = regs.sla(regs.a);                           m.step(0x1524, 8);
  regs.b = regs.a;                                     m.step(0x1525, 4);
  regs.and(regs.a);                                    m.step(0x1526, 4);

  if (regs.fZ) {
    m.step(0x153a, 12);
  } else {
    m.step(0x1528, 7);
    m.push16(0x152b);                                  m.step(0x1131, 17);
    m.call(0x1131);
    regs.e = regs.a;                                   m.step(0x152c, 4);
    regs.a = regs.c;                                   m.step(0x152d, 4);
    regs.and(regs.a);                                  m.step(0x152e, 4);
    if (regs.fZ) {
      m.step(0x1533, 12);
    } else {
      m.step(0x1530, 7);
      mem.write8(0x85e9, regs.a);                      m.step(0x1533, 13);
    }

    // loc_1533
    regs.hl = 0x85c9;                                  m.step(0x1536, 10);
    regs.a = regs.e;                                   m.step(0x1537, 4);
    m.push16(0x153a);                                  m.step(0x1119, 17);
    m.call(0x1119);
  }

  // loc_153a
  regs.a = mem.read8((regs.ix + 0x16) & 0xffff);       m.step(0x153d, 19);
  regs.cp(0x07);                                       m.step(0x153f, 7);
  if (regs.fZ) {
    m.step(0x3d99, 10);
    return m.call(0x3d99, 'jp 0x3d99 tail');
  }
  m.step(0x1542, 10);

  regs.a = regs.inc8(regs.a);                          m.step(0x1543, 4);
  mem.write8((regs.ix + 0x13) & 0xffff, regs.a);       m.step(0x1546, 19);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x01);         m.step(0x154a, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, regs.inc8(mem.read8((regs.ix + 0x02) & 0xffff)));
  m.step(0x154d, 23);

  // loc_154d
  m.push16(0x1550);                                    m.step(0x4006, 17);
  m.call(0x4006);
  mem.write8((regs.ix + 0x11) & 0xffff, regs.dec8(mem.read8((regs.ix + 0x11) & 0xffff)));
  m.step(0x1553, 23);
  if (regs.fNZ) {
    return m.ret(11);
  }
  m.step(0x1554, 5);
  m.step(0x3553, 10);
  return m.call(0x3553, 'jp 0x3553 tail');
}
