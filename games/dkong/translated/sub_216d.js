// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_216d  (ROM 0x216D–0x21B2).
 */
export function sub_216d(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  m.push16(0x2170); // `call` PUSHES -- 236e's pop/ret consume it on the miss
  m.step(0x216d, 17); // call 0x236e
  if (!m.call(0x236e)) return; // cpir miss: 236e already ret'd to 0x216A

  regs.a = regs.dec8(regs.a);
  m.step(0x2171, 4); // dec a
  if (regs.fNZ) {
    m.ret(11); // ret nz -- 236e returned A=0 variant
    return;
  }
  m.step(0x2172, 5); // ret nz NOT taken

  regs.a = regs.b;
  m.step(0x2173, 4); // ld a,b
  regs.sub(0x05); // wraps if B < 5
  m.step(0x2175, 7);
  mem.write8(R(0x17), regs.a);
  m.step(0x2178, 19); // ld (ix+0x17),a

  regs.a = mem.read8(0x6348);
  m.step(0x217b, 13); // ld a,(0x6348)
  regs.and(regs.a);
  m.step(0x217c, 4); // and a
  if (regs.fZ) {
    m.step(0x21b2, 10); // jp z,0x21b2 -- straight to the success tail
    return tail21b2(m, R);
  }
  m.step(0x217f, 10); // jp z not taken

  regs.a = mem.read8(0x6205);
  m.step(0x2182, 13); // ld a,(0x6205)
  regs.sub(0x04);
  m.step(0x2184, 7); // sub 0x04
  regs.cp(regs.d); // D = caller's L+5, laundered through 236e
  m.step(0x2185, 4); // cp d
  if (regs.fC) {
    m.ret(11); // ret c
    return;
  }
  m.step(0x2186, 5); // ret c NOT taken -- CARRY IS PROVEN 0 HERE

  regs.a = mem.read8(0x6380); // difficulty 0-5
  m.step(0x2189, 13);
  regs.rra(); // carry proven 0, so == A>>1
  m.step(0x218a, 4);
  regs.a = regs.inc8(regs.a);
  m.step(0x218b, 4); // inc a
  regs.b = regs.a; // B = (difficulty >> 1) + 1
  m.step(0x218c, 4); // ld b,a

  regs.a = mem.read8(0x6018); // the RNG
  m.step(0x218f, 13);
  regs.c = regs.a; // C keeps the FULL rng byte (reread at 0x21AE)
  m.step(0x2190, 4); // ld c,a
  regs.and(0x03);
  m.step(0x2192, 7); // and 0x03
  regs.cp(regs.b);
  m.step(0x2193, 4); // cp b
  if (!regs.fC) {
    m.ret(11); // ret nc -- the difficulty gate rejected this call
    return;
  }
  m.step(0x2194, 5); // ret nc NOT taken

  regs.hl = 0x6010; // the player-input byte
  m.step(0x2197, 10); // ld hl,0x6010
  regs.a = mem.read8(0x6203);
  m.step(0x219a, 13); // ld a,(0x6203)
  regs.cp(regs.e); // E = caller's H, set inside 236e
  m.step(0x219b, 4); // cp e
  if (regs.fZ) {
    m.step(0x21b2, 10); // jp z,0x21b2
    return tail21b2(m, R);
  }
  m.step(0x219e, 10); // jp z not taken

  if (!regs.fC) {
    // jp nc,0x21a9 -- Z excluded above, so strictly >
    m.step(0x21a9, 10);
    regs.bit(1, mem.read8(regs.hl));
    m.step(0x21ab, 12); // bit 1,(hl)
    if (regs.fNZ) {
      m.step(0x21b2, 10);
      return tail21b2(m, R);
    }
    m.step(0x21ae, 10); // bit 1 == 0
    return tail21ae(m, R);
  }
  m.step(0x21a1, 10); // jp nc not taken (A < E)

  regs.bit(0, mem.read8(regs.hl));
  m.step(0x21a3, 12); // bit 0,(hl)
  if (regs.fZ) {
    m.step(0x21ae, 10);
    return tail21ae(m, R);
  }
  m.step(0x21a6, 10); // bit 0 != 0
  m.step(0x21b2, 10); // jp 0x21b2 -- unconditional
  return tail21b2(m, R);
}

/**
 * tail21ae  (ROM 0x21AE–0x21B2) — 216D interior: RNG & 0x18 gate -> ret nz, else tail21b2.
 */
export function tail21ae(m, R) {
  const { regs } = m;
  regs.a = regs.c; // the full RNG byte saved at 0x218F
  m.step(0x21af, 4); // ld a,c
  regs.and(0x18);
  m.step(0x21b1, 7); // and 0x18
  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x21b2, 5); // ret nz NOT taken
  return tail21b2(m, R);
}

/**
 * tail21b2  (ROM 0x21B2–0x21B9) — 216D success tail: inc (ix+0x07), set 0,(ix+0x02).
 */
export function tail21b2(m, R) {
  const { regs, mem } = m;
  regs.incMem8(mem, R(0x07)); // inc (ix+0x07)
  m.step(0x21b5, 23);
  mem.write8(R(0x02), regs.set(0, mem.read8(R(0x02)))); // set 0,(ix+0x02) -- FIRST use of set
  m.step(0x21b9, 23);
  m.ret(10); // ret (0x21B9)
}
