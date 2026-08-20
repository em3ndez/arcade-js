// SPDX-License-Identifier: GPL-3.0-only

// loc_54c5  (ROM 0x54c5-0x54f8) -- spawn scheduler A. Gates on 0x8907 (>=4 skips the 0x8820 stage
// checks; <2 vs {2,3} pick different 0x8820 thresholds). Decrements countdown 0x8d04; only when it
// reaches 0 reloads it from table 0x55ef indexed by 0x8d12&0x0f (via rst 0x20), advances that index,
// seeds IX=0x8c30 / DE=0x0018 (stride) / B=1, and falls through into the spawn loop loc_54f9.
export function loc_54c5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);                  m.step(0x54c8, 13);  // 54c5  ld a,(0x8907)
  regs.cp(0x04);                               m.step(0x54ca, 7);
  if (regs.fNC) {
    m.step(0x54db, 12);                                             // 54ca  jr nc,0x54db taken
  } else {
    m.step(0x54cc, 7);
    regs.cp(0x02);                             m.step(0x54ce, 7);   // 54cc  cp 0x02 (flags kept across ld a)
    regs.a = mem.read8(0x8820);                m.step(0x54d1, 13);  // 54ce  ld a,(0x8820)
    if (regs.fC) {
      m.step(0x54d8, 12);                                           // 54d1  jr c,0x54d8 (old A < 2)
      regs.cp(0x03);                           m.step(0x54da, 7);
      if (regs.fC) { return m.ret(11); }                           // 54da  ret c
      m.step(0x54db, 5);
    } else {
      m.step(0x54d3, 7);                                            // 54d1  jr c not taken (old A in {2,3})
      regs.cp(0x02);                           m.step(0x54d5, 7);
      if (regs.fC) { return m.ret(11); }                           // 54d5  ret c
      m.step(0x54d6, 5);
      m.step(0x54db, 12);                                           // 54d6  jr 0x54db
    }
  }

  // 54db: per-type spawn countdown -- proceed only when it hits zero
  regs.hl = 0x8d04;                            m.step(0x54de, 10);
  regs.decMem8(mem, regs.hl);                  m.step(0x54df, 11);  // 54de  dec (hl)
  if (regs.fNZ) { return m.ret(11); }                              // 54df  ret nz
  m.step(0x54e0, 5);
  regs.hl = 0x55ef;                            m.step(0x54e3, 10);
  regs.a = mem.read8(0x8d12);                  m.step(0x54e6, 13);
  regs.and(0x0f);                              m.step(0x54e8, 7);
  m.push16(0x54e9); m.step(0x0020, 11); m.call(0x0020);            // 54e8  rst 0x20 (A = table[0x55ef + A])
  mem.write8(0x8d04, regs.a);                  m.step(0x54ec, 13);  // 54e9  ld (0x8d04),a -- reload countdown
  regs.hl = 0x8d12;                            m.step(0x54ef, 10);
  regs.incMem8(mem, regs.hl);                  m.step(0x54f0, 11);  // 54ec  inc (hl) -- advance table index
  regs.ix = 0x8c30;                            m.step(0x54f4, 14);
  regs.de = 0x0018;                            m.step(0x54f7, 10);
  regs.b = 0x01;                               m.step(0x54f9, 7);
  return m.call(0x54f9);                                            // fall through into loc_54f9
}
