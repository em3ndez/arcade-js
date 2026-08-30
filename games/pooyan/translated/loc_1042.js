// SPDX-License-Identifier: GPL-3.0-only

// loc_1042  (ROM 0x1042-0x107c) -- per-frame setup of the eagle(?) object at ix=0x8a80.
// Writes 1 to flag 0x8f3f, seats ix=0x8a80 / iy=0x8c90. If the object is inactive
// ((ix+0x02) != 0) OR a global-pause byte set ((0x8f24) | (0x8f57) != 0), it clears the
// object's control byte (ix+0x07)=0 and rets (loc_1078). Otherwise it selects a control
// mask from (0xa0a0) when (0x881f)!=0 else (0xa0c0), complements it, stores it into
// (ix+0x07); then if the object has a live sub-timer ((ix+0x1e)!=0) it rets, else it also
// clears bit 4 of (ix+0x07) before returning (loc_106a). No calls, no stack use.
export function loc_1042(m) {
  const { regs, mem } = m;

  regs.a = 0x01;                                          m.step(0x1044, 7);
  mem.write8(0x8f3f, regs.a);                             m.step(0x1047, 13);
  regs.ix = 0x8a80;                                       m.step(0x104b, 14);
  regs.iy = 0x8c90;                                       m.step(0x104f, 14);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);          m.step(0x1052, 19);
  regs.and(regs.a);                                       m.step(0x1053, 4);
  if (regs.fNZ) {
    m.step(0x1078, 12);
    return loc_1078(m);
  }
  m.step(0x1055, 7);

  regs.a = mem.read8(0x8f24);                             m.step(0x1058, 13);
  regs.hl = 0x8f57;                                       m.step(0x105b, 10);
  regs.or(mem.read8(regs.hl));                            m.step(0x105c, 7);
  if (regs.fNZ) {
    m.step(0x1078, 12);
    return loc_1078(m);
  }
  m.step(0x105e, 7);

  regs.a = mem.read8(0x881f);                             m.step(0x1061, 13);
  regs.and(regs.a);                                       m.step(0x1062, 4);
  regs.a = mem.read8(0xa0a0);                             m.step(0x1065, 13);
  if (regs.fNZ) {
    m.step(0x106a, 12);
  } else {
    m.step(0x1067, 7);
    regs.a = mem.read8(0xa0c0);                           m.step(0x106a, 13);
  }

  // loc_106a (fall-through target of the jr nz above)
  regs.cpl();                                             m.step(0x106b, 4);
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a);          m.step(0x106e, 19);
  regs.a = mem.read8((regs.ix + 0x1e) & 0xffff);          m.step(0x1071, 19);
  regs.and(regs.a);                                       m.step(0x1072, 4);
  if (regs.fNZ) {
    return m.ret(11);
  }
  m.step(0x1073, 5);

  mem.write8((regs.ix + 0x07) & 0xffff,
    regs.res(4, mem.read8((regs.ix + 0x07) & 0xffff)));   m.step(0x1077, 23);
  return m.ret(10);
}

// loc_1078  (ROM 0x1078-0x107c) -- clear the object control byte and ret. Reached only via
// the two jr nz branches inside loc_1042 (ix already seated), so it is not a standalone entry.
function loc_1078(m) {
  const { regs, mem } = m;
  mem.write8((regs.ix + 0x07) & 0xffff, 0x00);            m.step(0x107c, 19);
  return m.ret(10);
}
