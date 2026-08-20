// SPDX-License-Identifier: GPL-3.0-only

// loc_638a  (ROM 0x638a-0x63fa) -- per-slot proximity scan. For B slots (IX table stride 4 from
// 0x887c, HL list stride 0x18 from 0x8be8) test the actor at IY against the slot: skip empty slots
// ((hl)==0), offset the slot X by +5 or -2 (0x881f gate), and require |dx|<6 AND |dy|<6. On a hit,
// claim the slot (IX=HL), write state bytes 0/1/2 + 0x28, set its animation (0x381e -> table 0x63fb),
// flag 0x8d1b/0x8d1c per I, queue tile 0x07 (0x0ef9) and display cmd 0x0315 (rst 0x38), then
// skip-return (pop af discards the immediate return; ret goes one level up). No hit -> advance
// (inlined 0x63ef) and djnz. IY is a caller input.
export function loc_638a(m) {
  const { regs, mem } = m;

  for (;;) { // loc_638a: scan the current slot
    regs.a = mem.read8(regs.hl);      m.step(0x638b, 7);
    regs.and(regs.a);                 m.step(0x638c, 4);
    if (regs.fZ) {
      m.step(0x63ef, 12);             // 638c  jr z,0x63ef -- empty slot, advance
    } else {
      m.step(0x638e, 7);
      regs.e = 0x05;                  m.step(0x6390, 7);
      regs.a = mem.read8(0x881f);     m.step(0x6393, 13);
      regs.and(regs.a);               m.step(0x6394, 4);
      if (regs.fNZ) {
        m.step(0x6398, 12);           // 6394  jr nz,0x6398
      } else {
        m.step(0x6396, 7);
        regs.e = 0xfe;                m.step(0x6398, 7); // -2 offset
      }
      regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x639b, 19);
      regs.add(regs.e);               m.step(0x639c, 4);
      regs.e = regs.a;                m.step(0x639d, 4); // E = slot X + offset
      regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x63a0, 19);
      regs.add(0x08);                 m.step(0x63a2, 7);
      regs.d = regs.a;                m.step(0x63a3, 4); // D = slot Y + 8
      regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x63a6, 19);
      regs.sub(regs.e);               m.step(0x63a7, 4);
      if (regs.fNC) {
        m.step(0x63ab, 12);           // 63a7  jr nc,0x63ab
      } else {
        m.step(0x63a9, 7);
        regs.neg();                   m.step(0x63ab, 8); // |dx|
      }
      regs.cp(0x06);                  m.step(0x63ad, 7);
      if (regs.fNC) {
        m.step(0x63ef, 12);           // 63ad  jr nc,0x63ef -- dx too far, advance
      } else {
        m.step(0x63af, 7);
        regs.a = mem.read8((regs.iy + 0x02) & 0xffff); m.step(0x63b2, 19);
        regs.add(0x08);               m.step(0x63b4, 7);
        regs.sub(regs.d);             m.step(0x63b5, 4);
        if (regs.fNC) {
          m.step(0x63b9, 12);         // 63b5  jr nc,0x63b9
        } else {
          m.step(0x63b7, 7);
          regs.neg();                 m.step(0x63b9, 8); // |dy|
        }
        regs.cp(0x06);                m.step(0x63bb, 7);
        if (regs.fNC) {
          m.step(0x63ef, 12);         // 63bb  jr nc,0x63ef -- dy too far, advance
        } else {
          m.step(0x63bd, 7);          // 63bb  jr nc not taken -- hit
          // loc_63bd: claim the slot and spawn
          m.push16(regs.hl);          m.step(0x63be, 11);
          regs.ix = m.pop16();        m.step(0x63c0, 14); // IX = HL
          mem.write8((regs.ix + 0x00) & 0xffff, 0x00); m.step(0x63c4, 19);
          mem.write8((regs.ix + 0x01) & 0xffff, 0x01); m.step(0x63c8, 19);
          mem.write8((regs.ix + 0x02) & 0xffff, 0x02); m.step(0x63cc, 19);
          mem.write8((regs.ix + 0x11) & 0xffff, 0x28); m.step(0x63d0, 19);
          regs.de = 0x000f;           m.step(0x63d3, 10);
          regs.hl = 0x8d1b;           m.step(0x63d6, 10);
          regs.ldAI();                m.step(0x63d8, 9);
          regs.and(regs.a);           m.step(0x63d9, 4);
          if (regs.fZ) {
            m.step(0x63de, 12);       // 63d9  jr z,0x63de
          } else {
            m.step(0x63db, 7);
            regs.hl = 0x8d1c;         m.step(0x63de, 10);
          }
          mem.write8(regs.hl, 0x01);  m.step(0x63e0, 10);
          regs.de = 0x63fb;           m.step(0x63e3, 10);
          m.push16(0x63e6);
          m.step(0x381e, 17);         // 63e3  call 0x381e (set animation)
          m.call(0x381e);
          m.push16(0x63e9);
          m.step(0x0ef9, 17);         // 63e6  call 0x0ef9 (queue tile 0x07)
          m.call(0x0ef9);
          regs.de = 0x0315;           m.step(0x63ec, 10);
          m.push16(0x63ed);
          m.step(0x0038, 11);         // 63ec  rst 0x38 (queue display cmd 0x0315)
          m.call(0x0038);
          regs.af = m.pop16();        m.step(0x63ee, 10); // 63ed  pop af -- drop immediate return
          return m.ret(10);           // 63ee  ret -- skip-return one level up
        }
      }
    }

    // loc_63ef (inlined back-edge): advance to the next slot, djnz to the scan head
    regs.de = 0x0004;                 m.step(0x63f2, 10);
    regs.addIx(regs.de);              m.step(0x63f4, 15);
    regs.de = 0x0018;                 m.step(0x63f7, 10);
    regs.addHl(regs.de);              m.step(0x63f8, 11);
    if (regs.djnz()) { m.step(0x638a, 13); continue; } // 63f8  djnz 0x638a
    m.step(0x63fa, 8);
    return m.ret(10); // 63fa  ret
  }
}
