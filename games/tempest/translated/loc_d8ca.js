// SPDX-License-Identifier: GPL-3.0-only
// loc_d8ca  (ROM 0xd8ca-0xd92e) -- POKEY/EAROM-style write via S-as-counter: seeds S from A, then an
// outer loop (d8da, S counts down) writes $60c0/$60c1/$60e0 and spins two 3kHz sync loops (bit $0c00 /
// bmi+bpl) draining X:0->0 x Y, decrements S each pass, and tail-jumps to loc_da0a when S underflows.
// d8cd is a second (external) entry reached by loc_d931's jmp (with Y/A already set); it is exported below
// as loc_d8cd, and the d8ca entry seeds Y=A, A=0 then delegates to it.
export function loc_d8ca(m) {
  const { regs } = m;
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd8cb, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xd8cd, 2);
  return loc_d8cd(m);
}

export function loc_d8cd(m) {
  const { regs, mem } = m;
  mem.write8(0x79, regs.y); m.step(0xd8cf, 3);
  regs.a = regs.lsr(regs.a); m.step(0xd8d0, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd8d1, 2);
  regs.a = regs.asl(regs.a); m.step(0xd8d2, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd8d3, 2);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xd8d4, 2);
  regs.and(0x0f); m.step(0xd8d6, 2);
  if (regs.fNZ) { m.step(0xd8d9, 3); }
  else {
    m.step(0xd8d8, 2);
    regs.x = regs.inc8(regs.x); m.step(0xd8d9, 2);
  }
  regs.s = regs.x; m.step(0xd8da, 2);

  let outerAgain;
  do {
    regs.a = 0xa2; regs.setNZ(regs.a); m.step(0xd8dc, 2);
    mem.write8(0x60c1, regs.a); m.step(0xd8df, 4);
    regs.x = regs.s; regs.setNZ(regs.x); m.step(0xd8e0, 2);
    if (regs.fNZ) {
      m.step(0xd8e9, 3);
      regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xd8eb, 2);
      regs.y = 0x01; regs.setNZ(regs.y); m.step(0xd8ed, 2);
    } else {
      m.step(0xd8e2, 2);
      regs.a = 0x60; regs.setNZ(regs.a); m.step(0xd8e4, 2);
      regs.y = 0x09; regs.setNZ(regs.y); m.step(0xd8e6, 2);
      regs.clv(); m.step(0xd8e7, 2);
      m.step(0xd8ed, 3);
    }
    mem.write8(0x60c0, regs.a); m.step(0xd8f0, 4);
    regs.a = 0x03; regs.setNZ(regs.a); m.step(0xd8f2, 2);
    mem.write8(0x60e0, regs.a); m.step(0xd8f5, 4);
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xd8f7, 2);

    for (;;) {
      do {
        regs.bit(mem.read8(0x0c00)); m.step(0xd8fa, 4);
        if (regs.fN) { m.step(0xd8f7, 3); } else { m.step(0xd8fc, 2); }
      } while (regs.fN);
      do {
        regs.bit(mem.read8(0x0c00)); m.step(0xd8ff, 4);
        if (!regs.fN) { m.step(0xd8fc, 3); } else { m.step(0xd901, 2); }
      } while (!regs.fN);
      mem.write8(0x5000, regs.a); m.step(0xd904, 4);
      regs.x = regs.dec8(regs.x); m.step(0xd905, 2);
      if (regs.fNZ) { m.step(0xd8f7, 3); continue; }
      m.step(0xd907, 2);
      regs.y = regs.dec8(regs.y); m.step(0xd908, 2);
      if (regs.fNZ) { m.step(0xd8f7, 3); continue; }
      m.step(0xd90a, 2); break;
    }
    mem.write8(0x60c1, regs.x); m.step(0xd90d, 4);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xd90f, 2);
    mem.write8(0x60e0, regs.a); m.step(0xd912, 4);
    regs.y = 0x09; regs.setNZ(regs.y); m.step(0xd914, 2);

    for (;;) {
      do {
        regs.bit(mem.read8(0x0c00)); m.step(0xd917, 4);
        if (regs.fN) { m.step(0xd914, 3); } else { m.step(0xd919, 2); }
      } while (regs.fN);
      do {
        regs.bit(mem.read8(0x0c00)); m.step(0xd91c, 4);
        if (!regs.fN) { m.step(0xd919, 3); } else { m.step(0xd91e, 2); }
      } while (!regs.fN);
      mem.write8(0x5000, regs.a); m.step(0xd921, 4);
      regs.x = regs.dec8(regs.x); m.step(0xd922, 2);
      if (regs.fNZ) { m.step(0xd914, 3); continue; }
      m.step(0xd924, 2);
      regs.y = regs.dec8(regs.y); m.step(0xd925, 2);
      if (regs.fNZ) { m.step(0xd914, 3); continue; }
      m.step(0xd927, 2); break;
    }
    regs.x = regs.s; regs.setNZ(regs.x); m.step(0xd928, 2);
    regs.x = regs.dec8(regs.x); m.step(0xd929, 2);
    regs.s = regs.x; m.step(0xd92a, 2);
    if (!regs.fN) { m.step(0xd8da, 4); outerAgain = true; }
    else { m.step(0xd92c, 2); outerAgain = false; }
  } while (outerAgain);

  m.step(0xda0a, 3); return m.call(0xda0a);
}
