// SPDX-License-Identifier: GPL-3.0-only

// loc_34b0  (ROM 0x34b0-0x34f1) -- shared movement tail (jp'd into by loc_343e and loc_34f2).
// Blanks the actor sprite band (call loc_3553), decrements the 0x8d40 spawn counter and the
// 0x8901 depth counter, then renders the depth into two HUD tiles at 0x8743 / 0x8763: when the
// depth >= 0x0a it is converted to packed BCD by the 0x34dd inline loop (guarded by 0x8f50).
export function loc_34b0(m) {
  const { regs, mem } = m;

  m.push16(0x34b3); m.step(0x3553, 17); m.call(0x3553); // call 0x3553 -- blank sprite band
  regs.hl = 0x8d40;               m.step(0x34b6, 10);
  regs.decMem8(mem, regs.hl);     m.step(0x34b7, 11);   // dec (0x8d40)
  regs.hl = 0x8901;               m.step(0x34ba, 10);
  regs.a = mem.read8(regs.hl);    m.step(0x34bb, 7);
  regs.c = regs.a;                m.step(0x34bc, 4);
  regs.and(regs.a);               m.step(0x34bd, 4);
  if (regs.fZ) {
    m.step(0x34c0, 12);           // jr z,0x34c0
  } else {
    m.step(0x34bf, 7);
    regs.decMem8(mem, regs.hl);   m.step(0x34c0, 11);   // dec (0x8901)
  }
  regs.a = mem.read8(0x880a);     m.step(0x34c3, 13);
  regs.cp(0x04);                  m.step(0x34c5, 7);
  if (regs.fNZ) {
    m.step(0x34c9, 12);           // jr nz,0x34c9
  } else {
    m.step(0x34c7, 7);
    regs.l = regs.inc8(regs.l);   m.step(0x34c8, 4);    // inc l
    regs.incMem8(mem, regs.hl);   m.step(0x34c9, 11);   // inc (0x8902)
  }
  regs.a = mem.read8(0x8901);     m.step(0x34cc, 13);
  regs.b = regs.a;                m.step(0x34cd, 4);
  regs.hl = 0x8743;               m.step(0x34d0, 10);
  regs.de = 0x0020;               m.step(0x34d3, 10);
  regs.cp(0x0a);                  m.step(0x34d5, 7);
  if (regs.fC) {
    m.step(0x34e3, 12);           // jr c,0x34e3 -- < 0x0a, no BCD conversion
  } else {
    m.step(0x34d7, 7);
    regs.a = mem.read8(0x8f50);   m.step(0x34da, 13);
    regs.and(regs.a);             m.step(0x34db, 4);
    if (regs.fNZ) { return m.ret(11); } // ret nz
    m.step(0x34dc, 5);
    regs.xor(regs.a);             m.step(0x34dd, 4);    // xor a
    for (;;) { // loc_34dd: BCD-count B times -> A = packed BCD of B
      regs.add(0x01);             m.step(0x34df, 7);
      regs.daa();                 m.step(0x34e0, 4);
      if (regs.djnz()) { m.step(0x34dd, 13); } else { m.step(0x34e2, 8); break; }
    }
    regs.b = regs.a;              m.step(0x34e3, 4);     // ld b,a
  }

  regs.and(0x0f);                 m.step(0x34e5, 7);
  mem.write8(regs.hl, regs.a);    m.step(0x34e6, 7);     // low BCD digit -> (0x8743)
  regs.addHl(regs.de);            m.step(0x34e7, 11);    // HL += 0x20 -> 0x8763
  regs.a = regs.b;                m.step(0x34e8, 4);
  regs.rrca();                    m.step(0x34e9, 4);
  regs.rrca();                    m.step(0x34ea, 4);
  regs.rrca();                    m.step(0x34eb, 4);
  regs.rrca();                    m.step(0x34ec, 4);
  regs.and(0x0f);                 m.step(0x34ee, 7);
  regs.and(regs.a);               m.step(0x34ef, 4);
  if (regs.fZ) { return m.ret(11); } // ret z -- suppress a leading-zero digit
  m.step(0x34f0, 5);
  mem.write8(regs.hl, regs.a);    m.step(0x34f1, 7);     // high BCD digit -> (0x8763)
  return m.ret(10);
}
