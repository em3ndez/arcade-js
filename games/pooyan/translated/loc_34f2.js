// SPDX-License-Identifier: GPL-3.0-only

// loc_34f2  (ROM 0x34f2-0x3535) -- object Y-movement handler (m.call target from loc_4221).
// Moves (ix+0x05) toward the target by the signed step -(ix+0x0a); borrows into (ix+0x06),
// then compares the masked column (ix+0x06)&0x1f against the limit at 0x8d4b. Depending on
// whether it undershoots, matches, or overshoots it either tails into the shared movement tail
// loc_34b0, latches (ix+0x08)=0 and returns, or tails into loc_3473 to re-arm the row.
export function loc_34f2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);  m.step(0x34f5, 19);
  regs.neg();                                     m.step(0x34f7, 8);
  regs.b = regs.a;                                m.step(0x34f8, 4);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);  m.step(0x34fb, 19);
  regs.cp(regs.b);                                m.step(0x34fc, 4);
  if (regs.fNC) {
    m.step(0x3501, 12);                           // jr nc,0x3501
  } else {
    m.step(0x34fe, 7);
    regs.decMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x3501, 23); // dec (ix+0x06)
  }
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff)); m.step(0x3504, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);  m.step(0x3507, 19);
  regs.b = regs.a;                                m.step(0x3508, 4);
  regs.a = mem.read8(0x8d4b);                     m.step(0x350b, 13);
  regs.c = regs.a;                                m.step(0x350c, 4);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);  m.step(0x350f, 19);
  regs.and(0x1f);                                 m.step(0x3511, 7);
  regs.cp(regs.c);                                m.step(0x3512, 4);

  if (regs.fZ) {
    m.step(0x3524, 12);                           // jr z,0x3524 -- column == limit
    regs.and(regs.a);                             m.step(0x3525, 4);
    if (regs.fZ) { m.step(0x34b0, 10); return m.call(0x34b0); } // jp z,0x34b0 (TAIL)
    m.step(0x3528, 10);
    regs.a = mem.read8(0x880a);                   m.step(0x352b, 13);
    regs.cp(0x04);                                m.step(0x352d, 7);
    if (regs.fNZ) { return m.ret(11); }           // ret nz
    m.step(0x352e, 5);
    regs.a = mem.read8((regs.ix + 0x09) & 0xffff); m.step(0x3531, 19);
    regs.cp(regs.b);                              m.step(0x3532, 4);
    if (regs.fC) { return m.ret(11); }            // ret c
    m.step(0x3533, 5);
    m.step(0x3473, 10); return m.call(0x3473);    // jp 0x3473 (TAIL)
  } else {
    m.step(0x3514, 7);                            // jr z not taken
    if (regs.fNC) { return m.ret(11); }           // ret nc -- column past limit
    m.step(0x3515, 5);
    regs.and(regs.a);                             m.step(0x3516, 4);
    if (regs.fZ) { m.step(0x34b0, 10); return m.call(0x34b0); } // jp z,0x34b0 (TAIL)
    m.step(0x3519, 10);
    regs.a = mem.read8(0x880a);                   m.step(0x351c, 13);
    regs.cp(0x04);                                m.step(0x351e, 7);
    if (regs.fNZ) { return m.ret(11); }           // ret nz
    m.step(0x351f, 5);
    mem.write8((regs.ix + 0x08) & 0xffff, 0x00);  m.step(0x3523, 19);
    return m.ret(10);
  }
}
