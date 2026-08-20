// SPDX-License-Identifier: GPL-3.0-only

// loc_61b4  (ROM 0x61b4-0x6286) -- actor-collision handler, entered via `jp nz` at 0x607d.
// Saves HL/IY/BC, scans the 0x8ae0 actor table (5 slots, stride 0x18) for one whose (+0x14) id
// matches (HL+0x14). No match -> tail 0x6080. Match on a busy slot ((+0x0b)!=0) -> tail 0x6080.
// Else dispatch on the high nibble of the slot's (+0x16): 0 -> 0x6080; 0x50/0xd0 -> 0x6287;
// 0xf0 -> 0x630f; 0x40/default -> the proximity+award block (0x61fc). That block rejects to 0x60f2
// when |dx|>=9 or |dy|>=8, else IX<-HL, plays effect 0x381e, awards points into (ix+0x0a) and the
// re-matched slot's (+0x0a) (0x6358 table via rst 0x20), flags the slot (set 4,(iy+0x16)), zero-fills
// a 0x18-byte sprite buffer (0x8c90/0x8ca8 per I) then, after 0x0ef1, skip-returns (pop af drops the
// jp-caller's return) to the grandcaller. Loop head 0x61c6 is inlined (no external entry).
export function loc_61b4(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);            m.step(0x61b5, 11);
  m.push16(regs.iy);            m.step(0x61b7, 15);
  m.push16(regs.bc);            m.step(0x61b8, 11);
  regs.a = regs.l;              m.step(0x61b9, 4);
  regs.add(0x14);               m.step(0x61bb, 7);
  regs.l = regs.a;              m.step(0x61bc, 4);
  regs.a = mem.read8(regs.hl);  m.step(0x61bd, 7);
  regs.iy = 0x8ae0;             m.step(0x61c1, 14);
  regs.bc = 0x0018;             m.step(0x61c4, 10);
  regs.l = 0x05;                m.step(0x61c6, 7);

  // loc_61c6: scan 5 actor slots for (iy+0x14) == A
  let toPathA = false;
  for (;;) {
    regs.cp(mem.read8((regs.iy + 0x14) & 0xffff)); m.step(0x61c9, 19);
    if (regs.fZ) {
      m.step(0x61d7, 12);                                          // jr z,0x61d7 -- match
      regs.a = mem.read8((regs.iy + 0x0b) & 0xffff); m.step(0x61da, 19);
      regs.and(regs.a);                              m.step(0x61db, 4);
      if (regs.fNZ) { m.step(0x61d0, 12); toPathA = true; break; } // jr nz,0x61d0 -- busy slot
      m.step(0x61dd, 7);
      regs.a = mem.read8((regs.iy + 0x16) & 0xffff); m.step(0x61e0, 19);
      break;                                                       // -> dispatch
    }
    m.step(0x61cb, 7);
    regs.addIy(regs.bc);                           m.step(0x61cd, 15);
    regs.l = regs.dec8(regs.l);                    m.step(0x61ce, 4);
    if (regs.fNZ) { m.step(0x61c6, 12); continue; }                // jr nz,0x61c6
    m.step(0x61d0, 7); toPathA = true; break;                      // loop exhausted -> path A
  }

  if (toPathA) {
    // loc_61d0: restore regs, tail to 0x6080
    regs.bc = m.pop16(); m.step(0x61d1, 10);
    regs.iy = m.pop16(); m.step(0x61d3, 14);
    regs.hl = m.pop16(); m.step(0x61d4, 10);
    m.step(0x6080, 10); return m.call(0x6080);                     // jp 0x6080
  }

  // loc_61e0: restore regs, dispatch on high nibble of A
  regs.bc = m.pop16(); m.step(0x61e1, 10);
  regs.iy = m.pop16(); m.step(0x61e3, 14);
  regs.hl = m.pop16(); m.step(0x61e4, 10);
  regs.and(0xf0);      m.step(0x61e6, 7);
  if (regs.fZ) { m.step(0x6080, 10); return m.call(0x6080); }      // jp z,0x6080
  m.step(0x61e9, 10);
  regs.cp(0x40);       m.step(0x61eb, 7);
  if (regs.fZ) {
    m.step(0x61fc, 12);                                            // jr z,0x61fc
  } else {
    m.step(0x61ed, 7);
    regs.cp(0x50);     m.step(0x61ef, 7);
    if (regs.fZ) { m.step(0x6287, 10); return m.call(0x6287); }    // jp z,0x6287 (BOUNDARY)
    m.step(0x61f2, 10);
    regs.cp(0xf0);     m.step(0x61f4, 7);
    if (regs.fZ) { m.step(0x630f, 10); return m.call(0x630f); }    // jp z,0x630f (BOUNDARY)
    m.step(0x61f7, 10);
    regs.cp(0xd0);     m.step(0x61f9, 7);
    if (regs.fZ) { m.step(0x6287, 10); return m.call(0x6287); }    // jp z,0x6287 (BOUNDARY)
    m.step(0x61fc, 10);                                            // jp z not taken -> 0x61fc
  }

  // loc_61fc: proximity check between caller actor (IX) and slot (IY)
  regs.e = 0x06;                m.step(0x61fe, 7);
  regs.a = mem.read8(0x881f);   m.step(0x6201, 13);
  regs.and(regs.a);             m.step(0x6202, 4);
  if (regs.fNZ) { m.step(0x6206, 12); }                            // jr nz,0x6206
  else { m.step(0x6204, 7); regs.e = 0xfe; m.step(0x6206, 7); }
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x6209, 19);
  regs.add(regs.e);             m.step(0x620a, 4);
  regs.e = regs.a;              m.step(0x620b, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x620e, 19);
  regs.add(0x08);               m.step(0x6210, 7);
  regs.d = regs.a;              m.step(0x6211, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x6214, 19);
  regs.sub(regs.e);             m.step(0x6215, 4);
  if (regs.fNC) { m.step(0x6219, 12); }                            // jr nc,0x6219
  else { m.step(0x6217, 7); regs.neg(); m.step(0x6219, 8); }       // |dx|
  regs.cp(0x09);                m.step(0x621b, 7);
  if (regs.fNC) { m.step(0x60f2, 10); return m.call(0x60f2); }     // jp nc,0x60f2 -- |dx|>=9
  m.step(0x621e, 10);
  regs.a = mem.read8((regs.iy + 0x02) & 0xffff); m.step(0x6221, 19);
  regs.add(0x08);               m.step(0x6223, 7);
  regs.sub(regs.d);             m.step(0x6224, 4);
  if (regs.fNC) { m.step(0x6228, 12); }                            // jr nc,0x6228
  else { m.step(0x6226, 7); regs.neg(); m.step(0x6228, 8); }       // |dy|
  regs.cp(0x08);                m.step(0x622a, 7);
  if (regs.fNC) { m.step(0x60f2, 10); return m.call(0x60f2); }     // jp nc,0x60f2 -- |dy|>=8
  m.step(0x622d, 10);

  // loc_622d: award points, flag the slot, zero-fill the sprite buffer, skip-return
  m.push16(regs.hl);            m.step(0x622e, 11);
  regs.ix = m.pop16();          m.step(0x6230, 14); // pop ix -- IX <- HL (caller actor)
  regs.de = 0x6343;             m.step(0x6233, 10);
  m.push16(0x6236); m.step(0x381e, 17); m.call(0x381e);            // call 0x381e -- effect
  regs.hl = 0x6358;             m.step(0x6239, 10);
  regs.a = mem.read8(0x8907);   m.step(0x623c, 13);
  regs.and(0x07);               m.step(0x623e, 7);
  regs.rra();                   m.step(0x623f, 4);
  m.push16(0x6240); m.step(0x0020, 11); m.call(0x0020);            // rst 0x20 -- A = table[0x6358+A]
  regs.l = regs.a;              m.step(0x6241, 4);
  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff); m.step(0x6244, 19);
  regs.add(regs.l);             m.step(0x6245, 4);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a); m.step(0x6248, 19);
  regs.iy = 0x8ae0;             m.step(0x624c, 14);
  regs.a = mem.read8((regs.ix + 0x14) & 0xffff); m.step(0x624f, 19);
  regs.c = 0x06;                m.step(0x6251, 7);
  regs.de = 0x0018;             m.step(0x6254, 10);

  // loc_6254: re-find the matched slot (6 slots this time)
  for (;;) {
    regs.cp(mem.read8((regs.iy + 0x14) & 0xffff)); m.step(0x6257, 19);
    if (regs.fZ) { m.step(0x625e, 12); break; }                    // jr z,0x625e
    m.step(0x6259, 7);
    regs.addIy(regs.de);        m.step(0x625b, 15);
    regs.c = regs.dec8(regs.c); m.step(0x625c, 4);
    if (regs.fNZ) { m.step(0x6254, 12); continue; }                // jr nz,0x6254
    m.step(0x625e, 7); break;
  }

  regs.hl = 0x6358;             m.step(0x6261, 10);
  regs.a = mem.read8(0x8907);   m.step(0x6264, 13);
  regs.and(0x07);               m.step(0x6266, 7);
  regs.rra();                   m.step(0x6267, 4);
  m.push16(0x6268); m.step(0x0020, 11); m.call(0x0020);            // rst 0x20
  regs.l = regs.a;              m.step(0x6269, 4);
  regs.a = mem.read8((regs.iy + 0x0a) & 0xffff); m.step(0x626c, 19);
  regs.add(regs.l);             m.step(0x626d, 4);
  mem.write8((regs.iy + 0x0a) & 0xffff, regs.a); m.step(0x6270, 19);
  mem.write8((regs.iy + 0x16) & 0xffff, regs.set(4, mem.read8((regs.iy + 0x16) & 0xffff))); m.step(0x6274, 23);
  regs.hl = 0x8c90;             m.step(0x6277, 10);
  regs.ldAI();                  m.step(0x6279, 9); // A <- I, Z when I==0
  if (regs.fZ) { m.step(0x627e, 12); }                             // jr z,0x627e
  else { m.step(0x627b, 7); regs.hl = 0x8ca8; m.step(0x627e, 10); }
  regs.b = 0x18;                m.step(0x6280, 7);
  regs.xor(regs.a);             m.step(0x6281, 4);
  m.push16(0x6282); m.step(0x0010, 11); m.call(0x0010);            // rst 0x10 -- memset 0x18 = 0
  m.push16(0x6285); m.step(0x0ef1, 17); m.call(0x0ef1);            // call 0x0ef1
  regs.af = m.pop16();          m.step(0x6286, 10); // pop af -- drop the jp-caller's return
  return m.ret(10);             // 6286  ret -- skip-return to the grandcaller
}
