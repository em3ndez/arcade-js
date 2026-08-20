// SPDX-License-Identifier: GPL-3.0-only

// loc_210b  (ROM 0x210b-0x2156 + 0x2184-0x21cc) -- one-shot state advance gated by (0x8a80+7) bit4
// and the (0x8f02) once-latch. Clears the trigger bit, latches (0x8f02), and (when 0x8f30>=2 and the
// second object slot at 0x8c90+0x18 reads 2/0) arms bit1 of the slot flags. It then scans the two
// 0x8c90 slots (stride 0x18) for one whose bit0 is CLEAR: that slot is initialised (loc_2184 span)
// -- position from the 0x8a80 source, timers 0x0f/0x10, optional 0x8a98 fill via rst 0x10, a 0x8d19
// side flag -- and tails to loc_22b1. If both slots have bit0 set, (0x8a3c) decides: non-0 tails to
// loc_2157, else ret. Boundary calls: rst 0x10 (loc_0010), tail jp loc_22b1, tail jr loc_2157.
export function loc_210b(m) {
  const { regs, mem } = m;

  regs.ix = 0x8a80;                                              m.step(0x210f, 14);
  regs.bit(4, mem.read8((regs.ix + 0x07) & 0xffff), ((regs.ix + 0x07) >> 8) & 0xff); m.step(0x2113, 20);
  mem.write8((regs.ix + 0x07) & 0xffff, 0x00);                  m.step(0x2117, 19); // ld (ix+7),0 -- no flags
  if (regs.fZ) { return m.ret(11); }                             // ret z -- trigger bit4 was clear
  m.step(0x2118, 5);
  regs.hl = 0x8f02;                                             m.step(0x211b, 10);
  regs.a = mem.read8(regs.hl);                                 m.step(0x211c, 7);
  regs.and(regs.a);                                            m.step(0x211d, 4);
  if (regs.fNZ) { return m.ret(11); }                           // ret nz -- already latched
  m.step(0x211e, 5);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));          m.step(0x211f, 11); // inc (0x8f02)
  regs.iy = 0x8c90;                                            m.step(0x2123, 14);
  regs.a = mem.read8(0x8f30);                                  m.step(0x2126, 13);
  regs.cp(0x02);                                               m.step(0x2128, 7);
  if (regs.fC) {
    m.step(0x213f, 12);                                        // jr c,0x213f
  } else {
    m.step(0x212a, 7);
    regs.a = mem.read8((regs.iy + 0x18) & 0xffff);             m.step(0x212d, 19);
    regs.cp(0x02);                                             m.step(0x212f, 7);
    if (regs.fNZ) {
      m.step(0x213f, 12);                                      // jr nz,0x213f
    } else {
      m.step(0x2131, 7);
      regs.a = mem.read8((regs.iy + 0x00) & 0xffff);           m.step(0x2134, 19);
      regs.and(regs.a);                                        m.step(0x2135, 4);
      if (regs.fNZ) {
        m.step(0x213f, 12);                                    // jr nz,0x213f
      } else {
        m.step(0x2137, 7);
        mem.write8((regs.iy + 0x18) & 0xffff, 0x00);           m.step(0x213b, 19);
        mem.write8((regs.iy + 0x00) & 0xffff, regs.set(1, mem.read8((regs.iy + 0x00) & 0xffff))); m.step(0x213f, 23);
      }
    }
  }

  // loc_213f: scan the two slots for one with bit0 clear
  regs.de = 0x0018;                                            m.step(0x2142, 10);
  regs.b = 0x02;                                               m.step(0x2144, 7);
  for (;;) { // loc_2144
    const bit0 = regs.bit(0, mem.read8(regs.iy), (regs.iy >> 8) & 0xff); m.step(0x2148, 20);
    if (!bit0) {
      m.step(0x2184, 12);                                      // jr z,0x2184 -- init this slot

      // loc_2184
      mem.write8((regs.iy + 0x00) & 0xffff, regs.set(0, mem.read8((regs.iy + 0x00) & 0xffff))); m.step(0x2188, 23);
      regs.a = mem.read8((regs.ix + 0x04) & 0xffff);           m.step(0x218b, 19);
      regs.sub(0x03);                                          m.step(0x218d, 7);
      mem.write8((regs.iy + 0x04) & 0xffff, regs.a);           m.step(0x2190, 19);
      regs.a = mem.read8((regs.ix + 0x06) & 0xffff);           m.step(0x2193, 19);
      regs.add(0x04);                                          m.step(0x2195, 7);
      mem.write8((regs.iy + 0x06) & 0xffff, regs.a);           m.step(0x2198, 19);
      const bit1 = regs.bit(1, mem.read8(regs.iy), (regs.iy >> 8) & 0xff); m.step(0x219c, 20);
      if (bit1) {
        m.step(0x21a8, 12);                                    // jr nz,0x21a8
        mem.write8((regs.iy + 0x0f) & 0xffff, 0x10);           m.step(0x21ac, 19);
        mem.write8((regs.iy + 0x10) & 0xffff, 0x40);           m.step(0x21b0, 19);
        regs.a = 0x01;                                         m.step(0x21b2, 7);
        mem.write8(0x8d77, regs.a);                            m.step(0x21b5, 13);
        regs.xor(regs.a);                                      m.step(0x21b6, 4);
        regs.hl = 0x8a98;                                      m.step(0x21b9, 10);
        regs.b = 0x18;                                         m.step(0x21bb, 7);
        m.push16(0x21bc); m.step(0x0010, 11); m.call(0x0010);  // rst 0x10 -- fill 0x18 bytes at 0x8a98
      } else {
        m.step(0x219e, 7);                                     // jr nz not taken
        mem.write8((regs.iy + 0x0f) & 0xffff, 0x14);           m.step(0x21a2, 19);
        mem.write8((regs.iy + 0x10) & 0xffff, 0x40);           m.step(0x21a6, 19);
        m.step(0x21bc, 12);                                    // jr 0x21bc
      }

      // loc_21bc
      regs.hl = 0x8d19;                                        m.step(0x21bf, 10);
      m.push16(regs.iy);                                       m.step(0x21c1, 15); // push iy
      regs.de = m.pop16();                                     m.step(0x21c2, 10); // pop de -- DE = IY
      regs.xor(regs.a);                                        m.step(0x21c3, 4);
      const bit3 = regs.bit(3, regs.e);                        m.step(0x21c5, 8);
      if (!bit3) {
        m.step(0x21c8, 12);                                    // jr z,0x21c8
      } else {
        m.step(0x21c7, 7);
        regs.hl = (regs.hl + 1) & 0xffff;                      m.step(0x21c8, 6); // inc hl -- second slot's flag
      }
      // loc_21c8
      mem.write8(regs.hl, regs.a);                             m.step(0x21c9, 7);
      regs.hl = (regs.hl + 1) & 0xffff;                        m.step(0x21ca, 6);
      regs.hl = (regs.hl + 1) & 0xffff;                        m.step(0x21cb, 6);
      mem.write8(regs.hl, regs.a);                             m.step(0x21cc, 7);
      m.step(0x22b1, 10);                                      // jp 0x22b1 (tail)
      return m.call(0x22b1);
    }
    m.step(0x214a, 7);                                         // jr z not taken (bit0 set)
    regs.addIy(regs.de);                                       m.step(0x214c, 15);
    if (regs.djnz()) { m.step(0x2144, 13); } else { m.step(0x214e, 8); break; }
  }

  // loc_214e: both slots had bit0 set
  regs.d = (regs.ix >> 8) & 0xff;                              m.step(0x2150, 8); // ld d,ixh
  regs.e = 0x3c;                                               m.step(0x2152, 7);
  regs.a = mem.read8(regs.de);                                m.step(0x2153, 7);
  regs.and(regs.a);                                           m.step(0x2154, 4);
  if (regs.fNZ) {
    m.step(0x2157, 12);                                        // jr nz,0x2157 (tail)
    return m.call(0x2157);
  }
  m.step(0x2156, 7);
  return m.ret(10);                                            // 0x2156 ret
}
