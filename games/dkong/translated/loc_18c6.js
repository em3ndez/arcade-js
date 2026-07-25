// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_18c6  (ROM 0x18C6–0x196A) — 0x1644 idx 5: 0x62AF counter-driven staging; on wrap resets sequence + hands 0x600A=8.
 */
export function loc_18c6(m) {
  const { regs, mem } = m;
  regs.hl = 0x62af;
  m.step(0x18c9, 10); // ld hl,0x62af
  regs.decMem8(mem, regs.hl); // dec (hl) -- Z gates wrap
  m.step(0x18ca, 11);
  if (regs.fZ) return loc_18c6_wrap(m); // jp z,0x193d
  m.step(0x18cd, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x18ce, 7); // ld a,(hl)
  regs.and(0x07);
  m.step(0x18d0, 7); // and 0x07
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- every-8th gate
  m.step(0x18d1, 5);
  regs.hl = 0x6a25;
  m.step(0x18d4, 10); // ld hl,0x6a25
  regs.a = mem.read8(regs.hl);
  m.step(0x18d5, 7); // ld a,(hl)
  regs.xor(0x80);
  m.step(0x18d7, 7); // xor 0x80
  mem.write8(regs.hl, regs.a);
  m.step(0x18d8, 7); // ld (hl),a
  regs.hl = 0x6919;
  m.step(0x18db, 10); // ld hl,0x6919
  regs.b = mem.read8(regs.hl);
  m.step(0x18dc, 7); // ld b,(hl)
  regs.b = regs.res(5, regs.b); // res 5,b
  m.step(0x18de, 8);
  regs.xor(regs.a); // A = 0
  m.step(0x18df, 4);
  m.push16(0x18e2); m.step(0x3009, 17); m.call(0x3009);
  regs.or(0x20);
  m.step(0x18e4, 7); // or 0x20
  mem.write8(regs.hl, regs.a); // 0x6919 = A | 0x20
  m.step(0x18e5, 7); // ld (hl),a
  regs.hl = 0x62af;
  m.step(0x18e8, 10); // ld hl,0x62af
  regs.a = mem.read8(regs.hl);
  m.step(0x18e9, 7); // ld a,(hl)
  regs.cp(0xe0);
  m.step(0x18eb, 7); // cp 0xe0
  if (regs.fZ) {
    m.step(0x18ee, 10); // stage @0xE0
    regs.a = 0x50; m.step(0x18f0, 7); mem.write8(0x694f, regs.a); m.step(0x18f3, 13);
    regs.a = 0x00; m.step(0x18f5, 7); mem.write8(0x694d, regs.a); m.step(0x18f8, 13);
    regs.a = 0x9f; m.step(0x18fa, 7); mem.write8(0x694c, regs.a); m.step(0x18fd, 13);
    regs.a = mem.read8(0x6203); m.step(0x1900, 13); // ld a,(0x6203)
    regs.cp(0x80); m.step(0x1902, 7); // cp 0x80
    if (regs.fC) {
      m.step(0x1905, 10);
      regs.a = 0x80; m.step(0x1907, 7); mem.write8(0x694d, regs.a); m.step(0x190a, 13);
      regs.a = 0x5f; m.step(0x190c, 7); mem.write8(0x694c, regs.a); m.step(0x190f, 13);
    } else {
      m.step(0x190f, 10); // jp nc,0x190f
    }
    regs.a = mem.read8(regs.hl); // re-read 0x62AF
    m.step(0x1910, 7);
  } else {
    m.step(0x1910, 10); // jp nz,0x1910
  }
  regs.cp(0xc0);
  m.step(0x1912, 7); // cp 0xc0
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- not 0xC0
  m.step(0x1913, 5);
  regs.hl = 0x608a;
  m.step(0x1916, 10); // ld hl,0x608a
  mem.write8(regs.hl, 0x0c);
  m.step(0x1918, 10); // ld (hl),0x0c
  regs.a = mem.read8(0x6229);
  m.step(0x191b, 13); // ld a,(0x6229)
  regs.rrca();
  m.step(0x191c, 4); // rrca
  if (regs.fC) {
    m.step(0x1920, 12); // jr c -- keep 0x0C
  } else {
    m.step(0x191e, 7);
    mem.write8(regs.hl, 0x05); // 0x608A = 0x05
    m.step(0x1920, 10);
  }
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1921, 6); // inc hl
  mem.write8(regs.hl, 0x03);
  m.step(0x1923, 10); // 0x608B = 3
  regs.hl = 0x6a23;
  m.step(0x1926, 10); // ld hl,0x6a23
  mem.write8(regs.hl, 0x40); m.step(0x1928, 10);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x1929, 6);
  mem.write8(regs.hl, 0x09); m.step(0x192b, 10);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x192c, 6);
  mem.write8(regs.hl, 0x76); m.step(0x192e, 10);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x192f, 6);
  mem.write8(regs.hl, 0x8f); m.step(0x1931, 10); // record 8F 76 09 40 at 0x6A20
  regs.a = mem.read8(0x6203);
  m.step(0x1934, 13); // ld a,(0x6203)
  regs.cp(0x80);
  m.step(0x1936, 7); // cp 0x80
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x1937, 5);
  regs.a = 0x6f;
  m.step(0x1939, 7); // ld a,0x6f
  mem.write8(0x6a20, regs.a);
  m.step(0x193c, 13);
  m.ret();
}

/**
 * loc_18c6_wrap  (ROM 0x193D–0x196A) — 0x62AF-wrap: walk 0x622A, reset 0x6388=0, set 0x600A=8 (hand to state 8).
 */
export function loc_18c6_wrap(m) {
  const { regs, mem } = m;
  regs.hl = mem.read16(0x622a); // ld hl,(0x622a) INDIRECT
  m.step(0x1940, 16);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1941, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x1942, 7); // ld a,(hl)
  regs.cp(0x7f);
  m.step(0x1944, 7); // cp 0x7f
  if (regs.fZ) {
    m.step(0x1947, 10); // sentinel -> reset the walk
    regs.hl = 0x3a73;
    m.step(0x194a, 10); // ld hl,0x3a73
    regs.a = mem.read8(regs.hl);
    m.step(0x194b, 7); // ld a,(hl)
  } else {
    m.step(0x194b, 10);
  }
  mem.write16(0x622a, regs.hl);
  m.step(0x194e, 16); // ld (0x622a),hl
  mem.write8(0x6227, regs.a);
  m.step(0x1951, 13); // ld (0x6227),a
  regs.hl = 0x6229;
  m.step(0x1954, 10); // ld hl,0x6229
  regs.incMem8(mem, regs.hl); // inc (hl)
  m.step(0x1955, 11);
  regs.de = 0x0500;
  m.step(0x1958, 10); // ld de,0x0500
  m.push16(0x195b); m.step(0x309f, 17); m.call(0x309f);
  regs.xor(regs.a);
  m.step(0x195c, 4); // xor a
  mem.write8(0x622e, regs.a); // 0x622E = 0
  m.step(0x195f, 13);
  mem.write8(0x6388, regs.a); // 0x6388 = 0 -- RESET sequence
  m.step(0x1962, 13);
  regs.hl = 0x6009;
  m.step(0x1965, 10); // ld hl,0x6009
  mem.write8(regs.hl, 0xe0); // 0x6009 = 0xE0
  m.step(0x1967, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1968, 6); // inc hl
  mem.write8(regs.hl, 0x08); // 0x600A = 8 -- hand to state 8
  m.step(0x196a, 10);
  m.ret();
}
