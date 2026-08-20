// SPDX-License-Identifier: GPL-3.0-only

// loc_5b99  (ROM 0x5b99-0x5c74) -- proximity/collision check of one actor (IX record) against the
// 0x8c90 object pair, then hit registration. Guards: the actor must be armed (ix+0x0b bit0 or 0x8907
// bit0 clear), active (ix+0 bit0), flagged (ix+0x16 bit0) and in mode 5 (ix+2). It then scans the two
// 0x8c90 entries (stride 0x18, B=2): each must be present (iy+0 bit0/bit1) and within |dx|<0x10 and
// |dy|<9. On a hit it writes the hit sprite pointer (call 0x381e), then scans the 0x8b70 slot table
// (stride 0x18, B=5) for a matching id (ix+0x14 == iy+0x14); a match runs the register handler and
// BOTH hit exits do `pop af; ret`, discarding loc_5b99's own return so control unwinds to its
// caller's caller. The internal labels 0x5bbe (outer scan), 0x5c38 (inner scan), 0x5c46/0x5c48
// (skip tails) and 0x5c54 (found handler) are inlined -- none is an external call target and 0x5c48
// is a mid-block re-entry, so the cluster is one routine (LOOP-LATCH WATCH). Boundary: 0x5c75.
export function loc_5b99(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x0b) & 0xffff)); m.step(0x5b9d, 20);
  if (regs.fZ) {
    m.step(0x5b9f, 7);                             // jr nz not taken
    regs.a = mem.read8(0x8907);                    m.step(0x5ba2, 13);
    regs.bit(0, regs.a);                           m.step(0x5ba4, 8);
    if (regs.fNZ) { return m.ret(11); }            // ret nz -- not armed
    m.step(0x5ba5, 5);
  } else {
    m.step(0x5ba5, 12);                            // jr nz taken -- ix+0x0b armed
  }
  regs.bit(0, mem.read8((regs.ix + 0x00) & 0xffff)); m.step(0x5ba9, 20);
  if (regs.fZ) { return m.ret(11); }               // ret z -- inactive
  m.step(0x5baa, 5);
  regs.bit(0, mem.read8((regs.ix + 0x16) & 0xffff)); m.step(0x5bae, 20);
  if (regs.fZ) { return m.ret(11); }               // ret z -- flag clear
  m.step(0x5baf, 5);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);   m.step(0x5bb2, 19);
  regs.cp(0x05);                                   m.step(0x5bb4, 7);
  if (regs.fNZ) { return m.ret(11); }              // ret nz -- not mode 5
  m.step(0x5bb5, 5);
  regs.hl = 0x8848;                                m.step(0x5bb8, 10);
  regs.iy = 0x8c90;                                m.step(0x5bbc, 14);
  regs.b = 0x02;                                   m.step(0x5bbe, 7);

  for (;;) { // 0x5bbe: outer scan of the two 0x8c90 entries
    let incs; // skip-tail entry: 4 inc l (from 0x5c46) or 2 inc l (from 0x5c48)

    regs.bit(0, mem.read8((regs.iy + 0x00) & 0xffff)); m.step(0x5bc2, 20);
    if (regs.fZ) {
      m.step(0x5c46, 10); incs = 4;                // jp z 0x5c46 -- entry absent
    } else {
      m.step(0x5bc5, 10);
      regs.bit(1, mem.read8((regs.iy + 0x00) & 0xffff)); m.step(0x5bc9, 20);
      if (regs.fNZ) {
        m.step(0x5c46, 12); incs = 4;              // jr nz 0x5c46 -- entry busy
      } else {
        m.step(0x5bcb, 7);
        regs.e = 0x10;                             m.step(0x5bcd, 7);
        regs.a = mem.read8(0x881f);                m.step(0x5bd0, 13);
        regs.and(regs.a);                          m.step(0x5bd1, 4);
        if (regs.fNZ) { m.step(0x5bd5, 12); } else { m.step(0x5bd3, 7); regs.e = 0x08; m.step(0x5bd5, 7); }
        regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x5bd8, 19);
        regs.c = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x5bdb, 19);
        regs.c = regs.rlc(regs.c);                 m.step(0x5bdd, 8);
        regs.rla();                                m.step(0x5bde, 4);
        regs.c = regs.rlc(regs.c);                 m.step(0x5be0, 8);
        regs.rla();                                m.step(0x5be1, 4);
        regs.c = regs.rlc(regs.c);                 m.step(0x5be3, 8);
        regs.rla();                                m.step(0x5be4, 4);
        regs.add(regs.e);                          m.step(0x5be5, 4);
        regs.sub(mem.read8((regs.iy + 0x06) & 0xffff)); m.step(0x5be8, 19);
        if (regs.fNC) { m.step(0x5bec, 12); } else { m.step(0x5bea, 7); regs.neg(); m.step(0x5bec, 8); }
        regs.cp(0x10);                             m.step(0x5bee, 7);
        if (regs.fNC) {
          m.step(0x5c46, 12); incs = 4;            // jr nc 0x5c46 -- |dx| out of range
        } else {
          m.step(0x5bf0, 7);
          regs.l = regs.inc8(regs.l);              m.step(0x5bf1, 4);
          regs.l = regs.inc8(regs.l);              m.step(0x5bf2, 4);
          regs.e = 0x16;                           m.step(0x5bf4, 7);
          regs.a = mem.read8(0x8907);              m.step(0x5bf7, 13);
          regs.bit(0, regs.a);                     m.step(0x5bf9, 8);
          if (regs.fNZ) { m.step(0x5bfd, 12); } else { m.step(0x5bfb, 7); regs.e = 0x12; m.step(0x5bfd, 7); }
          regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x5c00, 19);
          regs.c = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x5c03, 19);
          regs.c = regs.rlc(regs.c);               m.step(0x5c05, 8);
          regs.rla();                              m.step(0x5c06, 4);
          regs.c = regs.rlc(regs.c);               m.step(0x5c08, 8);
          regs.rla();                              m.step(0x5c09, 4);
          regs.c = regs.rlc(regs.c);               m.step(0x5c0b, 8);
          regs.rla();                              m.step(0x5c0c, 4);
          regs.sub(regs.e);                        m.step(0x5c0d, 4);
          regs.sub(mem.read8((regs.iy + 0x04) & 0xffff)); m.step(0x5c10, 19);
          if (regs.fNC) { m.step(0x5c14, 12); } else { m.step(0x5c12, 7); regs.neg(); m.step(0x5c14, 8); }
          regs.cp(0x09);                           m.step(0x5c16, 7);
          if (regs.fNC) {
            m.step(0x5c48, 12); incs = 2;          // jr nc 0x5c48 -- |dy| out of range
          } else {
            // 0x5c18: hit -- pick the hit sprite (ix+0x07 bit1), stamp it, then scan the slot table
            m.step(0x5c18, 7);
            regs.de = 0x5c80;                      m.step(0x5c1b, 10);
            regs.bit(1, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x5c1f, 20);
            if (regs.fZ) { m.step(0x5c24, 12); } else { m.step(0x5c21, 7); regs.de = 0x5c89; m.step(0x5c24, 10); }
            m.push16(0x5c27); m.step(0x381e, 17); m.call(0x381e); // call 0x381e -- write sprite ptr
            mem.write8((regs.ix + 0x12) & 0xffff, 0x10); m.step(0x5c2b, 19);
            mem.write8((regs.ix + 0x16) & 0xffff, 0x02); m.step(0x5c2f, 19);
            regs.iy = 0x8b70;                      m.step(0x5c33, 14);
            regs.de = 0x0018;                      m.step(0x5c36, 10);
            regs.b = 0x05;                         m.step(0x5c38, 7);

            for (;;) { // 0x5c38: inner scan for the matching slot id
              regs.a = mem.read8((regs.ix + 0x14) & 0xffff);   m.step(0x5c3b, 19);
              regs.cp(mem.read8((regs.iy + 0x14) & 0xffff));   m.step(0x5c3e, 19);
              if (regs.fZ) {
                m.step(0x5c54, 12);                // jr z 0x5c54 -- slot found
                // 0x5c54: found handler
                regs.hl = 0x5c92;                  m.step(0x5c57, 10);
                regs.a = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x5c5a, 19);
                regs.and(0xf0);                    m.step(0x5c5c, 7);
                regs.rrca();                       m.step(0x5c5d, 4);
                regs.rrca();                       m.step(0x5c5e, 4);
                regs.rrca();                       m.step(0x5c5f, 4);
                regs.rrca();                       m.step(0x5c60, 4);
                m.push16(0x5c63); m.step(0x0c45, 17); m.call(0x0c45);
                regs.bit(0, mem.read8((regs.iy + 0x0b) & 0xffff)); m.step(0x5c67, 20);
                if (regs.fZ) { m.step(0x5c6c, 12); } else { m.step(0x5c69, 7); regs.de = 0x5cf9; m.step(0x5c6c, 10); }
                mem.write8((regs.iy + 0x16) & 0xffff, 0x02); m.step(0x5c70, 19);
                m.push16(0x5c73); m.step(0x5c75, 17); m.call(0x5c75); // BOUNDARY 0x5c75
                regs.af = m.pop16();               m.step(0x5c74, 10); // pop af -- drop own return
                return m.ret(10);                  // ret -- unwind to caller's caller
              }
              m.step(0x5c40, 7);
              regs.addIy(regs.de);                 m.step(0x5c42, 15);
              if (regs.djnz()) { m.step(0x5c38, 13); } else { m.step(0x5c44, 8); break; }
            }
            regs.af = m.pop16();                   m.step(0x5c45, 10); // pop af -- drop own return
            return m.ret(10);                      // ret -- unwind to caller's caller
          }
        }
      }
    }

    // 0x5c46 (incs=4) / 0x5c48 (incs=2): skip tail -- bump the field pointer, next 0x8c90 entry
    if (incs === 4) {
      regs.l = regs.inc8(regs.l);                  m.step(0x5c47, 4);
      regs.l = regs.inc8(regs.l);                  m.step(0x5c48, 4);
    }
    regs.l = regs.inc8(regs.l);                    m.step(0x5c49, 4);
    regs.l = regs.inc8(regs.l);                    m.step(0x5c4a, 4);
    regs.de = 0x0018;                              m.step(0x5c4d, 10);
    regs.addIy(regs.de);                           m.step(0x5c4f, 15);
    regs.b = regs.dec8(regs.b);                    m.step(0x5c50, 4);
    if (regs.fNZ) { m.step(0x5bbe, 10); continue; } // jp nz 0x5bbe
    m.step(0x5c53, 10);
    return m.ret(10);                              // ret -- no hit
  }
}
