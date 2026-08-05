// SPDX-License-Identifier: GPL-3.0-only

// loc_18c3  (ROM 0x18C3-0x19D9, Time Pilot)
export function loc_18c3(m) {
  const { regs, mem } = m;

  to19ce: {
    to19c8: {
      to19c0: {
        to199a: {
          to1998: {
            to1984: {
              to1975: {
                to1963: {
                  to194e: {
                    to1923: {
                      to1916: {
                        to1909: {
                          regs.a = mem.read8(0xa980);
                          m.step(0x18c6, 13); // ld a,(0xa980)
                          regs.and(0x01);
                          m.step(0x18c8, 7); // and 0x01 -- the frame parity

                          if (regs.fNZ) {
                            m.step(0x1984, 10); // jp nz,0x1984 (taken)
                            break to1984;
                          }
                          m.step(0x18cb, 10); // jp nz,0x1984 (not taken; jp costs 10 either way)

                          m.push16(0x18ce);
                          m.step(0x1ed1, 17); // call 0x1ed1 -- A = (0xA9AF) or (0xA9B0)
                          m.call(0x1ed1);

                          regs.hl = 0xa995;
                          m.step(0x18d1, 10); // ld hl,0xa995

                          regs.rrca();
                          m.step(0x18d2, 4); // rrca -- A bit 0 -> carry
                          mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
                          m.step(0x18d4, 15); // rl (hl) -- carry -> bit 0 of 0xA995
                          regs.hl = (regs.hl + 1) & 0xffff;
                          m.step(0x18d5, 6); // inc hl

                          regs.rrca();
                          m.step(0x18d6, 4); // rrca
                          mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
                          m.step(0x18d8, 15); // rl (hl) -- 0xA996
                          regs.hl = (regs.hl + 1) & 0xffff;
                          m.step(0x18d9, 6); // inc hl

                          regs.rrca();
                          m.step(0x18da, 4); // rrca
                          regs.rrca();
                          m.step(0x18db, 4); // rrca -- two bits skipped
                          regs.rrca();
                          m.step(0x18dc, 4); // rrca
                          mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
                          m.step(0x18de, 15); // rl (hl) -- 0xA997
                          regs.hl = (regs.hl + 1) & 0xffff;
                          m.step(0x18df, 6); // inc hl

                          regs.rrca();
                          m.step(0x18e0, 4); // rrca
                          mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
                          m.step(0x18e2, 15); // rl (hl) -- 0xA998

                          regs.a = mem.read8(regs.hl);
                          m.step(0x18e3, 7); // ld a,(hl) -- 0xA998
                          regs.and(0x07);
                          m.step(0x18e5, 7); // and 0x07
                          regs.a = regs.dec8(regs.a);
                          m.step(0x18e6, 4); // dec a

                          if (regs.fZ) {
                            m.step(0x1923, 12); // jr z,0x1923 (taken)
                            break to1923;
                          }
                          m.step(0x18e8, 7); // jr z,0x1923 (not taken)

                          regs.hl = (regs.hl - 1) & 0xffff;
                          m.step(0x18e9, 6); // dec hl -- 0xA997
                          regs.a = mem.read8(regs.hl);
                          m.step(0x18ea, 7); // ld a,(hl)
                          regs.and(0x07);
                          m.step(0x18ec, 7); // and 0x07
                          regs.a = regs.dec8(regs.a);
                          m.step(0x18ed, 4); // dec a

                          if (regs.fZ) {
                            m.step(0x1923, 12); // jr z,0x1923 (taken)
                            break to1923;
                          }
                          m.step(0x18ef, 7); // jr z,0x1923 (not taken)

                          regs.hl = (regs.hl - 1) & 0xffff;
                          m.step(0x18f0, 6); // dec hl -- 0xA996
                          regs.a = mem.read8(regs.hl);
                          m.step(0x18f1, 7); // ld a,(hl)
                          regs.cp(0xff);
                          m.step(0x18f3, 7); // cp 0xff

                          if (regs.fZ) {
                            m.push16(0x18f6);
                            m.step(0x1980, 17); // call z,0x1980 (taken) -- clears (hl), A = 0
                            m.call(0x1980);
                          } else {
                            m.step(0x18f6, 10); // call z,0x1980 (not taken)
                          }

                          regs.and(0x07);
                          m.step(0x18f8, 7); // and 0x07
                          regs.a = regs.dec8(regs.a);
                          m.step(0x18f9, 4); // dec a

                          if (regs.fZ) {
                            m.step(0x1916, 12); // jr z,0x1916 (taken)
                            break to1916;
                          }
                          m.step(0x18fb, 7); // jr z,0x1916 (not taken)

                          regs.hl = (regs.hl - 1) & 0xffff;
                          m.step(0x18fc, 6); // dec hl -- 0xA995
                          regs.a = mem.read8(regs.hl);
                          m.step(0x18fd, 7); // ld a,(hl)
                          regs.cp(0x7f);
                          m.step(0x18ff, 7); // cp 0x7f

                          if (regs.fZ) {
                            m.push16(0x1902);
                            m.step(0x1980, 17); // call z,0x1980 (taken)
                            m.call(0x1980);
                          } else {
                            m.step(0x1902, 10); // call z,0x1980 (not taken)
                          }

                          regs.and(0x07);
                          m.step(0x1904, 7); // and 0x07
                          regs.a = regs.dec8(regs.a);
                          m.step(0x1905, 4); // dec a

                          if (regs.fZ) {
                            m.step(0x1909, 12); // jr z,0x1909 (taken)
                            break to1909;
                          }
                          m.step(0x1907, 7); // jr z,0x1909 (not taken)

                          m.step(0x1963, 12); // jr 0x1963
                          break to1963;
                        }

                        regs.hl = 0xa999;
                        m.step(0x190c, 10); // ld hl,0xa999
                        regs.decMem8(mem, regs.hl);
                        m.step(0x190d, 11); // dec (hl)
                        regs.a = mem.read8(regs.hl);
                        m.step(0x190e, 7); // ld a,(hl)
                        regs.cp(0x80);
                        m.step(0x1910, 7); // cp 0x80

                        if (regs.fC) {
                          m.step(0x194e, 12); // jr c,0x194e (taken)
                          break to194e;
                        }
                        m.step(0x1912, 7); // jr c,0x194e (not taken)

                        mem.write8(regs.hl, 0x1a);
                        m.step(0x1914, 10); // ld (hl),0x1a
                        m.step(0x194e, 12); // jr 0x194e
                        break to194e;
                      }

                      regs.hl = 0xa999;
                      m.step(0x1919, 10); // ld hl,0xa999
                      regs.incMem8(mem, regs.hl);
                      m.step(0x191a, 11); // inc (hl)
                      regs.a = mem.read8(regs.hl);
                      m.step(0x191b, 7); // ld a,(hl)
                      regs.cp(0x1b);
                      m.step(0x191d, 7); // cp 0x1b

                      if (regs.fC) {
                        m.step(0x194e, 12); // jr c,0x194e (taken)
                        break to194e;
                      }
                      m.step(0x191f, 7); // jr c,0x194e (not taken)

                      mem.write8(regs.hl, 0x00);
                      m.step(0x1921, 10); // ld (hl),0x00
                      m.step(0x194e, 12); // jr 0x194e
                      break to194e;
                    }

                    regs.a = mem.read8(0xa999);
                    m.step(0x1926, 13); // ld a,(0xa999)
                    regs.hl = 0x12c7;
                    m.step(0x1929, 10); // ld hl,0x12c7

                    m.push16(0x192a);
                    m.step(0x0008, 11); // rst 0x08 -- A = glyph table[A]
                    m.call(0x0008);

                    regs.hl = mem.read8(0xa991) | (mem.read8(0xa992) << 8);
                    m.step(0x192d, 16); // ld hl,(0xa991)
                    regs.de = mem.read8(0xa993) | (mem.read8(0xa994) << 8);
                    m.step(0x1931, 20); // ld de,(0xa993)
                    mem.write8(regs.de, regs.a);
                    m.step(0x1932, 7); // ld (de),a
                    mem.write8(regs.hl, regs.a);
                    m.step(0x1933, 7); // ld (hl),a
                    regs.a = mem.read8(0xa990);
                    m.step(0x1936, 13); // ld a,(0xa990) -- the colour byte
                    regs.d = regs.res(2, regs.d);
                    m.step(0x1938, 8); // res 2,d -- video RAM 0xA4xx -> colour RAM 0xA0xx
                    mem.write8(regs.de, regs.a);
                    m.step(0x1939, 7); // ld (de),a
                    regs.d = regs.set(2, regs.d);
                    m.step(0x193b, 8); // set 2,d -- back to video RAM

                    m.push16(0x193c);
                    m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20, one tilemap row
                    m.call(0x0020);

                    regs.hl = (regs.hl + 1) & 0xffff;
                    m.step(0x193d, 6); // inc hl
                    mem.write8(0xa991, regs.l);
                    mem.write8(0xa992, regs.h);
                    m.step(0x1940, 16); // ld (0xa991),hl
                    mem.write8(0xa993, regs.e);
                    mem.write8(0xa994, regs.d);
                    m.step(0x1944, 20); // ld (0xa993),de

                    regs.hl = 0xa99a;
                    m.step(0x1947, 10); // ld hl,0xa99a
                    regs.decMem8(mem, regs.hl);
                    m.step(0x1948, 11); // dec (hl) -- the remaining-cells count

                    if (regs.fZ) {
                      m.step(0x1975, 12); // jr z,0x1975 (taken)
                      break to1975;
                    }
                    m.step(0x194a, 7); // jr z,0x1975 (not taken)

                    regs.xor(regs.a);
                    m.step(0x194b, 4); // xor a
                    mem.write8(0xa999, regs.a);
                    m.step(0x194e, 13); // ld (0xa999),a
                  }

                  regs.de = mem.read8(0xa993) | (mem.read8(0xa994) << 8);
                  m.step(0x1952, 20); // ld de,(0xa993)
                  regs.a = mem.read8(0xa999);
                  m.step(0x1955, 13); // ld a,(0xa999)
                  regs.hl = 0x12c7;
                  m.step(0x1958, 10); // ld hl,0x12c7

                  m.push16(0x1959);
                  m.step(0x0008, 11); // rst 0x08 -- A = glyph table[A]
                  m.call(0x0008);

                  mem.write8(regs.de, regs.a);
                  m.step(0x195a, 7); // ld (de),a
                  regs.d = regs.res(2, regs.d);
                  m.step(0x195c, 8); // res 2,d -- colour RAM; NOT put back
                  regs.a = 0x10;
                  m.step(0x195e, 7); // ld a,0x10
                  mem.write8(regs.de, regs.a);
                  m.step(0x195f, 7); // ld (de),a
                  regs.xor(regs.a);
                  m.step(0x1960, 4); // xor a
                  mem.write8(0xa99c, regs.a);
                  m.step(0x1963, 13); // ld (0xa99c),a
                }

                regs.a = mem.read8(0xa980);
                m.step(0x1966, 13); // ld a,(0xa980)
                regs.and(0x07);
                m.step(0x1968, 7); // and 0x07 -- every eighth frame only

                if (regs.fNZ) {
                  m.step(0x199a, 12); // jr nz,0x199a (taken)
                  break to199a;
                }
                m.step(0x196a, 7); // jr nz,0x199a (not taken)

                regs.hl = 0xa9eb;
                m.step(0x196d, 10); // ld hl,0xa9eb
                regs.decMem8(mem, regs.hl);
                m.step(0x196e, 11); // dec (hl)

                if (regs.fNZ) {
                  m.step(0x199a, 12); // jr nz,0x199a (taken)
                  break to199a;
                }
                m.step(0x1970, 7); // jr nz,0x199a (not taken)

                regs.hl = mem.read8(0xa993) | (mem.read8(0xa994) << 8);
                m.step(0x1973, 16); // ld hl,(0xa993)
                mem.write8(regs.hl, 0xf1);
                m.step(0x1975, 10); // ld (hl),0xf1
              }

              regs.a = 0x3c;
              m.step(0x1977, 7); // ld a,0x3c
              mem.write8(0xa9eb, regs.a);
              m.step(0x197a, 13); // ld (0xa9eb),a

              m.push16(0x197d);
              m.step(0x5634, 17); // call 0x5634
              m.call(0x5634);

              m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL, its ret goes to our caller
              return m.call(0x0f1a);
            }

            regs.hl = 0xa99c;
            m.step(0x1987, 10); // ld hl,0xa99c
            regs.incMem8(mem, regs.hl);
            m.step(0x1988, 11); // inc (hl)
            regs.hl = mem.read8(0xa993) | (mem.read8(0xa994) << 8);
            m.step(0x198b, 16); // ld hl,(0xa993)
            regs.h = regs.res(2, regs.h);
            m.step(0x198d, 8); // res 2,h -- the colour-RAM twin of that cell
            regs.a = mem.read8(0xa99c);
            m.step(0x1990, 13); // ld a,(0xa99c)

            const bit4 = regs.bit(4, regs.a);
            m.step(0x1992, 8); // bit 4,a -- the flash phase

            if (!bit4) {
              m.step(0x1998, 12); // jr z,0x1998 (taken)
              break to1998;
            }
            m.step(0x1994, 7); // jr z,0x1998 (not taken)

            mem.write8(regs.hl, 0x14);
            m.step(0x1996, 10); // ld (hl),0x14
            m.step(0x199a, 12); // jr 0x199a
            break to199a;
          }

          mem.write8(regs.hl, 0x10);
          m.step(0x199a, 10); // ld (hl),0x10
        }

        regs.hl = 0xad20;
        m.step(0x199d, 10); // ld hl,0xad20
        regs.a = mem.read8(0xad10);
        m.step(0x19a0, 13); // ld a,(0xad10)
        regs.or(mem.read8(regs.hl));
        m.step(0x19a1, 7); // or (hl) -- either object still busy?

        if (regs.fNZ) {
          m.ret(11); // 19a1  ret nz (taken)
          return;
        }
        m.step(0x19a2, 5); // ret nz (not taken)

        regs.a = mem.read8(0xa9c0);
        m.step(0x19a5, 13); // ld a,(0xa9c0)
        regs.and(regs.a);
        m.step(0x19a6, 4); // and a

        if (regs.fNZ) {
          m.step(0x19ce, 12); // jr nz,0x19ce (taken)
          break to19ce;
        }
        m.step(0x19a8, 7); // jr nz,0x19ce (not taken)

        regs.a = mem.read8(0xa986);
        m.step(0x19ab, 13); // ld a,(0xa986)
        regs.cp(0x01);
        const below = regs.fC;
        const equal = regs.fZ;
        m.step(0x19ad, 7); // cp 0x01

        if (below) {
          m.ret(11); // 19ad  ret c (taken)
          return;
        }
        m.step(0x19ae, 5); // ret c (not taken)

        if (equal) {
          m.step(0x19c0, 12); // jr z,0x19c0 (taken)
          break to19c0;
        }
        m.step(0x19b0, 7); // jr z,0x19c0 (not taken)

        regs.a = mem.read8(0xa9ae);
        m.step(0x19b3, 13); // ld a,(0xa9ae)
        regs.and(0x18);
        m.step(0x19b5, 7); // and 0x18

        if (regs.fZ) {
          m.ret(11); // 19b5  ret z (taken)
          return;
        }
        m.step(0x19b6, 5); // ret z (not taken)

        regs.cp(0x08);
        m.step(0x19b8, 7); // cp 0x08

        if (regs.fZ) {
          m.step(0x19c8, 12); // jr z,0x19c8 (taken)
          break to19c8;
        }
        m.step(0x19ba, 7); // jr z,0x19c8 (not taken)

        m.push16(0x19bd);
        m.step(0x15b6, 17); // call 0x15b6
        m.call(0x15b6);

        m.step(0x189e, 10); // jp 0x189e -- TAIL
        return m.call(0x189e);
      }

      regs.a = mem.read8(0xa9ae);
      m.step(0x19c3, 13); // ld a,(0xa9ae)
      regs.and(0x18);
      m.step(0x19c5, 7); // and 0x18
      regs.cp(0x08);
      m.step(0x19c7, 7); // cp 0x08

      if (regs.fNZ) {
        m.ret(11); // 19c7  ret nz (taken)
        return;
      }
      m.step(0x19c8, 5); // ret nz (not taken)
    }

    m.push16(0x19cb);
    m.step(0x15b6, 17); // call 0x15b6
    m.call(0x15b6);

    m.step(0x3215, 10); // jp 0x3215 -- TAIL
    return m.call(0x3215);
  }

  regs.a = mem.read8(0xa9ae);
  m.step(0x19d1, 13); // ld a,(0xa9ae)
  regs.and(0x18);
  m.step(0x19d3, 7); // and 0x18

  if (regs.fZ) {
    m.ret(11); // 19d3  ret z (taken)
    return;
  }
  m.step(0x19d4, 5); // ret z (not taken)

  m.push16(0x19d7);
  m.step(0x15b6, 17); // call 0x15b6
  m.call(0x15b6);

  m.step(0x1690, 10); // jp 0x1690 -- TAIL
  return m.call(0x1690);
}
