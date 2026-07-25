// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2be1  (ROM 0x2BE1–0x2C02).
 */
export function entry_2be1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x620c);
  m.step(0x2be4, 13); // ld a,(0x620c)
  regs.sub(mem.read8((regs.ix + 0x05) & 0xffff)); // sub (ix+0x05)
  m.step(0x2be7, 19);
  regs.add(regs.e); // add a,e
  m.step(0x2be8, 4);
  regs.cp(regs.c); // cp c
  m.step(0x2be9, 4);

  if (regs.fZ) {
    m.step(0x2bef, 10); // jp z,0x2bef -- A == C
  } else {
    m.step(0x2bec, 10); // jp z not taken
    if (regs.fNC) {
      // -- loc_2bf8: A > C, PLAIN return --
      m.step(0x2bf8, 10); // jp nc,0x2bf8
      regs.a = 0x02;
      m.step(0x2bfa, 7); // ld a,0x02
      regs.b = 0x00;
      m.step(0x2bfc, 7); // ld b,0x00
      m.ret(); // 0x2BFC -- normal return
      return true;
    }
    m.step(0x2bef, 10); // jp nc not taken (A < C) -- falls into loc_2bef
  }

  // -- loc_2bef: A <= C, store then the double-skip --
  regs.a = regs.c;
  m.step(0x2bf0, 4); // ld a,c
  regs.sub(0x07);
  m.step(0x2bf2, 7); // sub 0x07
  mem.write8(0x6205, regs.a); // (0x6205) = C - 7
  m.step(0x2bf5, 13);
  m.step(0x2bfd, 10); // jp 0x2bfd

  // -- loc_2bfd: A=1, B=1, POP TWICE, ret -> TWO FRAMES UP --
  regs.a = 0x01;
  m.step(0x2bff, 7); // ld a,0x01
  regs.b = regs.a;
  m.step(0x2c00, 4); // ld b,a
  regs.hl = m.pop16(); // pop hl -- discard R1 (2b9b's own return)
  m.step(0x2c01, 10);
  regs.hl = m.pop16(); // pop hl -- discard R2 (2b9b's caller's return) -- DOUBLED
  m.step(0x2c02, 10);
  m.ret(); // 0x2C02 -- rets to R3, two frames above 2b9b's caller
  return false; // double-unwound (see the header)
}
