// SPDX-License-Identifier: GPL-3.0-only
// loc_a8e7  (ROM 0xa8e7-0xa97c) -- per-frame setup: two loc_a97f calls gated by $05/$3e state, then
// (unless $00==4) rebuilds $3b/$3c and two vector blocks (the $aace eor-checksum into $016c, and the
// $061b/$31fa pair copy into $2f60,x), draws via df39, and issues a chain of ab14/b0c6 calls before rts.
// Several exits branch to the a97c rts. Indexed reads may add +1 T on a page cross.
export function loc_a8e7(m) {
  const { regs, mem } = m;
  m.push16(0xa8e9); m.step(0xa8ea, 6); m.call(0xaaa8);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa8ec, 2);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa8ee, 2);
  m.push16(0xa8f0); m.step(0xa8f1, 6); m.call(0xa97f);
  regs.bit(mem.read8(0x05)); m.step(0xa8f3, 3);
  // a8f3 bmi 0xa8fe
  let run_a8fe = true;
  if (regs.fN) {
    m.step(0xa8fe, 3);
  } else {
    m.step(0xa8f5, 2);
    regs.a = mem.read8(0x43); regs.setNZ(regs.a); m.step(0xa8f7, 3);
    regs.ora(mem.read8(0x44)); m.step(0xa8f9, 3);
    regs.ora(mem.read8(0x45)); m.step(0xa8fb, 3);
    regs.clv(); m.step(0xa8fc, 2);
    // a8fc bvc 0xa900
    if (regs.fNV) { m.step(0xa900, 3); run_a8fe = false; } else { m.step(0xa8fe, 2); }
  }
  if (run_a8fe) {
    regs.a = mem.read8(0x3e); regs.setNZ(regs.a); m.step(0xa900, 3);
  }
  // a900 beq 0xa908
  if (regs.fZ) {
    m.step(0xa908, 3);
  } else {
    m.step(0xa902, 2);
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa904, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa905, 2);
    m.push16(0xa907); m.step(0xa908, 6); m.call(0xa97f);
  }
  regs.a = mem.read8(0x00); regs.setNZ(regs.a); m.step(0xa90a, 3);
  regs.cmp(0x04); m.step(0xa90c, 2);
  // a90c beq 0xa943
  if (regs.fZ) {
    m.step(0xa943, 3);
  } else {
    m.step(0xa90e, 2);
    regs.a = 0x1d; regs.setNZ(regs.a); m.step(0xa910, 2);
    mem.write8(0x3b, regs.a); m.step(0xa912, 3);
    regs.a = 0x07; regs.setNZ(regs.a); m.step(0xa914, 2);
    mem.write8(0x3c, regs.a); m.step(0xa916, 3);
    regs.x = mem.read8(0xcde4); regs.setNZ(regs.x); m.step(0xa919, 4);
    m.push16(0xa91b); m.step(0xa91c, 6); m.call(0xa9d7);
    regs.y = 0x0a; regs.setNZ(regs.y); m.step(0xa91e, 2);
    regs.a = 0xa7; regs.setNZ(regs.a); m.step(0xa920, 2);
    do {
      regs.eor(mem.read8((0xaace + regs.y) & 0xffff)); m.step(0xa923, 4);
      regs.y = regs.dec8(regs.y); m.step(0xa924, 2);
      // a924 bpl 0xa920
      if (regs.fPl) { m.step(0xa920, 3); } else { m.step(0xa926, 2); break; }
    } while (true);
    mem.write8(0x016c, regs.a); m.step(0xa929, 4);
    regs.x = mem.read8(0xcde5); regs.setNZ(regs.x); m.step(0xa92c, 4);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0xa92e, 2);
    mem.write8(0x38, regs.a); m.step(0xa930, 3);
    do {
      regs.y = mem.read8(0x38); regs.setNZ(regs.y); m.step(0xa932, 3);
      regs.a = mem.read8((0x061b + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa935, 4);
      regs.a = regs.asl(regs.a); m.step(0xa936, 2);
      regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa937, 2);
      regs.a = mem.read8((0x31fa + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa93a, 4);
      mem.write8((0x2f60 + regs.x) & 0xffff, regs.a); m.step(0xa93d, 5);
      regs.x = regs.inc8(regs.x); m.step(0xa93e, 2);
      regs.x = regs.inc8(regs.x); m.step(0xa93f, 2);
      mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xa941, 5);
      // a941 bpl 0xa930
      if (regs.fPl) { m.step(0xa930, 3); } else { m.step(0xa943, 2); break; }
    } while (true);
  }
  regs.a = 0x2f; regs.setNZ(regs.a); m.step(0xa945, 2);
  regs.x = 0x60; regs.setNZ(regs.x); m.step(0xa947, 2);
  m.push16(0xa949); m.step(0xa94a, 6); m.call(0xdf39);
  regs.a = mem.read8(0x0123); regs.setNZ(regs.a); m.step(0xa94d, 4);
  // a94d bpl 0xa954
  if (regs.fPl) {
    m.step(0xa954, 3);
  } else {
    m.step(0xa94f, 2);
    regs.x = 0x36; regs.setNZ(regs.x); m.step(0xa951, 2);
    m.push16(0xa953); m.step(0xa954, 6); m.call(0xab14);
  }
  regs.a = mem.read8(0x00); regs.setNZ(regs.a); m.step(0xa956, 3);
  regs.cmp(0x18); m.step(0xa958, 2);
  // a958 bne 0xa97c (-> rts)
  if (regs.fNZ) { m.step(0xa97c, 3); return m.ret(6); }
  m.step(0xa95a, 2);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xa95c, 3);
  // a95c bpl 0xa97c (-> rts)
  if (regs.fPl) { m.step(0xa97c, 3); return m.ret(6); }
  m.step(0xa95e, 2);
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xa960, 3);
  regs.a = mem.read8((0x0102 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa963, 4);
  // a963 beq 0xa972
  if (regs.fZ) {
    m.step(0xa972, 3);
  } else {
    m.step(0xa965, 2);
    regs.x = 0x30; regs.setNZ(regs.x); m.step(0xa967, 2);
    m.push16(0xa969); m.step(0xa96a, 6); m.call(0xab14);
    regs.y = mem.read8(0x3d); regs.setNZ(regs.y); m.step(0xa96c, 3);
    regs.x = mem.read8((0x0102 + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xa96f, 4);
    m.push16(0xa971); m.step(0xa972, 6); m.call(0xb0c6);
  }
  regs.x = 0x3a; regs.setNZ(regs.x); m.step(0xa974, 2);
  m.push16(0xa976); m.step(0xa977, 6); m.call(0xab14);
  regs.x = 0x38; regs.setNZ(regs.x); m.step(0xa979, 2);
  m.push16(0xa97b); m.step(0xa97c, 6); m.call(0xab14);
  return m.ret(6);
}
