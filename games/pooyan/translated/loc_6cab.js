// SPDX-License-Identifier: GPL-3.0-only

// loc_6cab  (ROM 0x6cab-0x6da5) -- target-acquisition / aim-indicator updater. Bails unless
// (0x8806)==0 and (0x8d32)==0. If (0x8f24)!=0 it clears the indicator flag byte (0x8a87) and rets.
// Otherwise runs loc_6bee, bails if (0x8d54)!=0, then:
//   - (0x8f30)==1              -> mark "on target" (0x8a87 bit2=1,bit3=0) and ret (loc_6d0d).
//   - (0x8f41)!=0              -> re-evaluate the locked target (loc_6d4d): if it left the valid
//                                 band reset the 5-byte lock at 0x8f40 (loc_6d60), else recompute an
//                                 aim delta on a 8-frame cadence and set the bit2/bit3 indicator.
//   - otherwise                -> scan the 6 sprite blocks at 0x8ae0 (stride 0x18) against the
//                                 y-slots at 0x8852 (stride 4), pick the closest in-band target,
//                                 record its lock (0x8f40..0x8f44), then set bit2/bit3 from the
//                                 comparison (loc_6d0d "above" / loc_6d12 "below").
// loc_6bee is a boundary (untranslated); rst 0x10 (loc_0010) is the 5-byte block fill.
export function loc_6cab(m) {
  const { regs, mem } = m;

  // 0x6d0d tail: indicator "on target / above" -- (0x8a87) bit2=1, bit3=0, ret. HL is 0x8a87.
  const tail6d0d = () => {
    mem.write8(regs.hl, regs.set(2, mem.read8(regs.hl))); m.step(0x6d0f, 15);
    mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl))); m.step(0x6d11, 15);
    m.ret(10);
  };
  // 0x6d12 tail: indicator "below" -- (0x8a87) bit3=1, bit2=0, ret. HL is 0x8a87.
  const tail6d12 = () => {
    mem.write8(regs.hl, regs.set(3, mem.read8(regs.hl))); m.step(0x6d14, 15);
    mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl))); m.step(0x6d16, 15);
    m.ret(10);
  };

  // loc_6d4d: re-evaluate the currently-locked target (reached via jp nz at 0x6cd7).
  const block6d4d = () => {
    block6d68: {
      block6d60: {
        regs.hl = mem.read16(0x8f43);      m.step(0x6d50, 16);
        regs.a = mem.read8(regs.hl);       m.step(0x6d51, 7);
        regs.and(regs.a);                  m.step(0x6d52, 4);
        if (regs.fNZ) { m.step(0x6d60, 12); break block6d60; } // jr nz,0x6d60
        m.step(0x6d54, 7);
        regs.hl = mem.read16(0x8f41);      m.step(0x6d57, 16);
        regs.a = mem.read8(regs.hl);       m.step(0x6d58, 7);
        regs.cp(0x40);                     m.step(0x6d5a, 7);
        if (regs.fC) { m.step(0x6d60, 12); break block6d60; } // jr c,0x6d60
        m.step(0x6d5c, 7);
        regs.cp(0xc0);                     m.step(0x6d5e, 7);
        if (regs.fC) { m.step(0x6d68, 12); break block6d68; } // jr c,0x6d68
        m.step(0x6d60, 7);                 // jr c not taken -> fall into loc_6d60
      }
      // loc_6d60: target invalid -> clear the 5-byte lock at 0x8f40, ret
      regs.xor(regs.a);                    m.step(0x6d61, 4);
      regs.hl = 0x8f40;                    m.step(0x6d64, 10);
      regs.b = 0x05;                       m.step(0x6d66, 7);
      m.push16(0x6d67);
      m.step(0x0010, 11);                  // 6d66  rst 0x10 (loc_0010) -- fill 5 bytes = 0
      m.call(0x0010);
      return m.ret(10);                    // 6d67  ret
    }

    // loc_6d68: recompute the aim delta for the locked target
    regs.c = regs.a;                       m.step(0x6d69, 4);
    regs.a = mem.read8(0x8907);            m.step(0x6d6c, 13);
    regs.bit(0, regs.a);                   m.step(0x6d6e, 8);
    regs.a = mem.read8(0x8842);            m.step(0x6d71, 13);
    if (regs.fNZ) {
      m.step(0x6d77, 12);                  // jr nz,0x6d77
      regs.add(0x14);                      m.step(0x6d79, 7);
    } else {
      m.step(0x6d73, 7);                   // jr nz not taken
      regs.sub(0x02);                      m.step(0x6d75, 7);
      m.step(0x6d79, 12);                  // 6d75  jr 0x6d79
    }
    // loc_6d79
    regs.hl = 0x8a87;                      m.step(0x6d7c, 10);
    regs.b = regs.a;                       m.step(0x6d7d, 4);
    regs.a = mem.read8(0x8f03);            m.step(0x6d80, 13);
    regs.a = regs.inc8(regs.a);            m.step(0x6d81, 4);
    mem.write8(0x8f03, regs.a);            m.step(0x6d84, 13);
    regs.and(0x07);                        m.step(0x6d86, 7);
    block6d96: {
      block6d95: {
        if (regs.fNZ) { m.step(0x6d95, 12); break block6d95; } // jr nz,0x6d95 (not the cadence frame)
        m.step(0x6d88, 7);
        regs.a = regs.b;                   m.step(0x6d89, 4);
        regs.add(0x08);                    m.step(0x6d8b, 7);
        regs.cp(regs.c);                   m.step(0x6d8c, 4);
        if (regs.fC) { m.step(0x6d95, 12); break block6d95; } // jr c,0x6d95
        m.step(0x6d8e, 7);
        regs.sub(0x10);                    m.step(0x6d90, 7);
        regs.cp(regs.c);                   m.step(0x6d91, 4);
        regs.a = 0x10;                     m.step(0x6d93, 7);
        if (regs.fC) { m.step(0x6d96, 12); break block6d96; } // jr c,0x6d96 (keep A=0x10, skip xor)
        m.step(0x6d95, 7);                 // jr c not taken -> fall into loc_6d95
      }
      // loc_6d95
      regs.xor(regs.a);                    m.step(0x6d96, 4);
    }
    // loc_6d96
    mem.write8(regs.hl, regs.a);           m.step(0x6d97, 7); // (0x8a87) = aim delta indicator
    regs.a = regs.b;                       m.step(0x6d98, 4);
    regs.cp(regs.c);                       m.step(0x6d99, 4);
    if (regs.fZ) {
      m.step(0x6da1, 12);                  // jr z,0x6da1 -- exactly on target
      mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl))); m.step(0x6da3, 15);
      mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl))); m.step(0x6da5, 15);
      return m.ret(10);                    // 6da5  ret
    }
    m.step(0x6d9b, 7);                     // jr z not taken
    if (regs.fC) { m.step(0x6d12, 10); return tail6d12(); } // jp c,0x6d12
    m.step(0x6d9e, 10);                    // jp c not taken
    m.step(0x6d0d, 10);                    // 6d9e  jp 0x6d0d
    return tail6d0d();
  };

  // ---- loc_6cab entry ----
  regs.a = mem.read8(0x8806);          m.step(0x6cae, 13);
  regs.and(regs.a);                    m.step(0x6caf, 4);
  if (regs.fNZ) { return m.ret(11); }  // 6caf  ret nz
  m.step(0x6cb0, 5);
  regs.a = mem.read8(0x8d32);          m.step(0x6cb3, 13);
  regs.and(regs.a);                    m.step(0x6cb4, 4);
  if (regs.fNZ) { return m.ret(11); }  // 6cb4  ret nz
  m.step(0x6cb5, 5);
  regs.a = mem.read8(0x8f24);          m.step(0x6cb8, 13);
  regs.and(regs.a);                    m.step(0x6cb9, 4);
  regs.hl = 0x8a87;                    m.step(0x6cbc, 10);
  if (regs.fNZ) {
    m.step(0x6cbe, 7);                 // jr z not taken -- (0x8f24)!=0, clear indicator
    regs.xor(regs.a);                  m.step(0x6cbf, 4);
    mem.write8(regs.hl, regs.a);       m.step(0x6cc0, 7);
    return m.ret(10);                  // 6cc0  ret
  }
  m.step(0x6cc1, 12);                  // 6cbc  jr z,0x6cc1

  m.push16(0x6cc4);
  m.step(0x6bee, 17);                  // 6cc1  call 0x6bee
  m.call(0x6bee);
  regs.a = mem.read8(0x8d54);          m.step(0x6cc7, 13);
  regs.and(regs.a);                    m.step(0x6cc8, 4);
  if (regs.fNZ) { return m.ret(11); }  // 6cc8  ret nz
  m.step(0x6cc9, 5);
  regs.hl = 0x8a87;                    m.step(0x6ccc, 10);
  regs.a = mem.read8(0x8f30);          m.step(0x6ccf, 13);
  regs.cp(0x01);                       m.step(0x6cd1, 7);
  if (regs.fZ) { m.step(0x6d0d, 12); return tail6d0d(); } // jr z,0x6d0d
  m.step(0x6cd3, 7);                   // jr z not taken

  regs.a = mem.read8(0x8f41);          m.step(0x6cd6, 13);
  regs.and(regs.a);                    m.step(0x6cd7, 4);
  if (regs.fNZ) { m.step(0x6d4d, 10); return block6d4d(); } // jp nz,0x6d4d
  m.step(0x6cda, 10);                  // jp nz not taken

  // loc_6cda: scan the 6 sprite blocks for the closest in-band target
  regs.hl = 0x8842;                    m.step(0x6cdd, 10);
  regs.ix = 0x8ae0;                    m.step(0x6ce1, 14);
  regs.iy = 0x8852;                    m.step(0x6ce5, 14);
  regs.b = 0x06;                       m.step(0x6ce7, 7);

  for (;;) { // loc_6ce7
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x6cea, 19);
    regs.and(regs.a);                  m.step(0x6ceb, 4);
    if (regs.fNZ) {
      m.step(0x6d17, 12);              // jr nz,0x6d17 -- block active, evaluate its y-slot
      block6ced: {
        regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x6d1a, 19);
        regs.cp(0x40);                 m.step(0x6d1c, 7);
        if (regs.fC) { m.step(0x6ced, 12); break block6ced; }  // jr c,0x6ced
        m.step(0x6d1e, 7);
        regs.cp(0xc0);                 m.step(0x6d20, 7);
        if (regs.fNC) { m.step(0x6ced, 12); break block6ced; } // jr nc,0x6ced
        m.step(0x6d22, 7);
        regs.sub(mem.read8(regs.hl));  m.step(0x6d23, 7);
        if (regs.fNC) {
          m.step(0x6d26, 12);          // jr nc,0x6d26
        } else {
          m.step(0x6d25, 7);           // jr nc not taken
          regs.cpl();                  m.step(0x6d26, 4); // A = |delta|
        }
        // loc_6d26
        regs.c = regs.a;               m.step(0x6d27, 4);
        regs.a = mem.read8(0x8f40);    m.step(0x6d2a, 13);
        regs.and(regs.a);              m.step(0x6d2b, 4);
        let store = false;
        if (regs.fZ) {
          m.step(0x6d31, 12);          // jr z,0x6d31 -- no lock yet, take this one
          store = true;
        } else {
          m.step(0x6d2d, 7);           // jr z not taken
          regs.cp(regs.c);             m.step(0x6d2e, 4); // cp c -- reg ALU, 4T
          if (regs.fNC) { m.step(0x6ced, 12); break block6ced; } // jr nc,0x6ced -- not closer
          m.step(0x6d30, 7);           // jr nc not taken
          regs.a = regs.c;             m.step(0x6d31, 4);
          store = true;
        }
        if (store) {
          // loc_6d31: record this target's distance + pointers
          mem.write8(0x8f40, regs.a);  m.step(0x6d34, 13);
          m.push16(regs.iy);           m.step(0x6d36, 15); // push iy
          regs.de = m.pop16();         m.step(0x6d37, 10); // pop de -> DE = IY
          regs.a = regs.e;             m.step(0x6d38, 4);
          mem.write8(0x8f41, regs.a);  m.step(0x6d3b, 13);
          regs.a = regs.d;             m.step(0x6d3c, 4);
          mem.write8(0x8f42, regs.a);  m.step(0x6d3f, 13);
          m.push16(regs.ix);           m.step(0x6d41, 15); // push ix
          regs.de = m.pop16();         m.step(0x6d42, 10); // pop de -> DE = IX
          regs.de = (regs.de + 1) & 0xffff; m.step(0x6d43, 6);
          regs.a = regs.e;             m.step(0x6d44, 4);
          mem.write8(0x8f43, regs.a);  m.step(0x6d47, 13);
          regs.a = regs.d;             m.step(0x6d48, 4);
          mem.write8(0x8f44, regs.a);  m.step(0x6d4b, 13);
          m.step(0x6ced, 12);          // 6d4b  jr 0x6ced
        }
      }
    } else {
      m.step(0x6ced, 7);               // jr nz not taken
    }
    // loc_6ced
    regs.de = 0x0018;                  m.step(0x6cf0, 10);
    regs.addIx(regs.de);               m.step(0x6cf2, 15);
    regs.de = 0x0004;                  m.step(0x6cf5, 10);
    regs.addIy(regs.de);               m.step(0x6cf7, 15);
    if (regs.djnz()) { m.step(0x6ce7, 13); continue; }
    m.step(0x6cf9, 8);
    break;
  }

  // loc_6cf9: if a target was locked, set the above/below indicator from the comparison
  regs.a = mem.read8(0x8f41);          m.step(0x6cfc, 13);
  regs.and(regs.a);                    m.step(0x6cfd, 4);
  if (regs.fZ) { return m.ret(11); }   // 6cfd  ret z -- nothing locked
  m.step(0x6cfe, 5);
  regs.a = mem.read8(0x8842);          m.step(0x6d01, 13);
  regs.c = regs.a;                     m.step(0x6d02, 4);
  regs.de = mem.read16(0x8f41);        m.step(0x6d06, 20);
  regs.hl = 0x8a87;                    m.step(0x6d09, 10);
  regs.a = mem.read8(regs.de);         m.step(0x6d0a, 7);
  regs.cp(regs.c);                     m.step(0x6d0b, 4);
  if (regs.fNC) { m.step(0x6d12, 12); return tail6d12(); } // jr nc,0x6d12
  m.step(0x6d0d, 7);                   // jr nc not taken -> fall into loc_6d0d
  return tail6d0d();
}
