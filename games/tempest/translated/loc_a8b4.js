// SPDX-License-Identifier: GPL-3.0-only
// loc_a8b4  (ROM 0xa8b4-0xa97c) -- per-frame setup: sets $72, calls df6a/b0d1, on $05>=0 picks an X index
// and runs ab14/ab0d + copies $31e4 into $2fa6/$2fa8; then a97f draws, conditional a97f, and when $00!=4
// builds the $016c checksum (eor loop over $aace) + a 3-entry table copy from $061b/$31fa into $2f60,x;
// df39, then bit-tested ab14 draws + a $0102-indexed b0c6 call. All branches are intra-routine (JS flow).
export function loc_a8b4(m) {
  const { regs, mem } = m;
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa8b6, 2);
  mem.write8(0x72, regs.a); m.step(0xa8b8, 3);
  m.push16(0xa8ba); m.step(0xa8bb, 6); m.call(0xdf6a);
  regs.y = 0x05; regs.setNZ(regs.y); m.step(0xa8bd, 2);
  m.push16(0xa8bf); m.step(0xa8c0, 6); m.call(0xb0d1);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xa8c2, 3);
  // a8c2 bmi 0xa8ea -- skip the ab14/ab0d block when $05 negative
  if (regs.fN) {
    m.step(0xa8ea, 3);
  } else {
    m.step(0xa8c4, 2);
    let toC = false;
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xa8c6, 2);
    regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xa8c8, 3);
    regs.and(0x20); m.step(0xa8ca, 2);
    // a8ca bne 0xa8d8
    if (regs.fNZ) { m.step(0xa8d8, 3); toC = true; }
    else {
      m.step(0xa8cc, 2);
      regs.x = 0x22; regs.setNZ(regs.x); m.step(0xa8ce, 2);
      regs.a = mem.read8(0x06); regs.setNZ(regs.a); m.step(0xa8d0, 3);
      // a8d0 beq 0xa8d8
      if (regs.fZ) { m.step(0xa8d8, 3); toC = true; }
      else {
        m.step(0xa8d2, 2);
        regs.bit(mem.read8(0xa2)); m.step(0xa8d4, 3);
        // a8d4 bmi 0xa8d8
        if (regs.fN) { m.step(0xa8d8, 3); toC = true; }
        else {
          m.step(0xa8d6, 2);
          regs.x = 0x06; regs.setNZ(regs.x); m.step(0xa8d8, 2);
        }
      }
    }
    void toC;
    m.push16(0xa8da); m.step(0xa8db, 6); m.call(0xab14);
    m.push16(0xa8dd); m.step(0xa8de, 6); m.call(0xab0d);
    regs.a = mem.read8(0x31e4); regs.setNZ(regs.a); m.step(0xa8e1, 4);
    mem.write8(0x2fa6, regs.a); m.step(0xa8e4, 4);
    mem.write8(0x2fa8, regs.a); m.step(0xa8e7, 4);
    m.push16(0xa8e9); m.step(0xa8ea, 6); m.call(0xaaa8);
  }
  // a8ea (merge)
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa8ec, 2);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa8ee, 2);
  m.push16(0xa8f0); m.step(0xa8f1, 6); m.call(0xa97f);
  regs.bit(mem.read8(0x05)); m.step(0xa8f3, 3);
  // a8f3 bmi 0xa8fe -- taken: lda $3e at a8fe; not taken: ora $43/$44/$45 then bvc (always) to a900
  if (regs.fN) {
    m.step(0xa8fe, 3);
    regs.a = mem.read8(0x3e); regs.setNZ(regs.a); m.step(0xa900, 3);
  } else {
    m.step(0xa8f5, 2);
    regs.a = mem.read8(0x43); regs.setNZ(regs.a); m.step(0xa8f7, 3);
    regs.ora(mem.read8(0x44)); m.step(0xa8f9, 3);
    regs.ora(mem.read8(0x45)); m.step(0xa8fb, 3);
    regs.clv(); m.step(0xa8fc, 2);
    m.step(0xa900, 3);
  }
  // a900 (merge)
  // a900 beq 0xa908 -- skip the second a97f call when the value is zero
  if (regs.fZ) {
    m.step(0xa908, 3);
  } else {
    m.step(0xa902, 2);
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa904, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa905, 2);
    m.push16(0xa907); m.step(0xa908, 6); m.call(0xa97f);
  }
  // a908 (merge)
  regs.a = mem.read8(0x00); regs.setNZ(regs.a); m.step(0xa90a, 3);
  regs.cmp(0x04); m.step(0xa90c, 2);
  // a90c beq 0xa943 -- when $00==4 skip the checksum/table-copy blocks
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
    // a920..a924: eor $aace,y ; dey ; bpl $a920  (checksum loop, y = 0x0a..0x00)
    for (;;) {
      regs.eor(mem.read8((0xaace + regs.y) & 0xffff)); m.step(0xa923, 4);
      regs.y = regs.dec8(regs.y); m.step(0xa924, 2);
      if (regs.fN) { m.step(0xa926, 2); break; }
      m.step(0xa920, 3);
    }
    mem.write8(0x016c, regs.a); m.step(0xa929, 4);
    regs.x = mem.read8(0xcde5); regs.setNZ(regs.x); m.step(0xa92c, 4);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0xa92e, 2);
    mem.write8(0x38, regs.a); m.step(0xa930, 3);
    // a930..a941: table copy, counter $38 = 2..0, dest $2f60,x stepping by 2
    for (;;) {
      regs.y = mem.read8(0x38); regs.setNZ(regs.y); m.step(0xa932, 3);
      regs.a = mem.read8((0x061b + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa935, 4);
      regs.a = regs.asl(regs.a); m.step(0xa936, 2);
      regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa937, 2);
      regs.a = mem.read8((0x31fa + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa93a, 4);
      mem.write8((0x2f60 + regs.x) & 0xffff, regs.a); m.step(0xa93d, 5);
      regs.x = regs.inc8(regs.x); m.step(0xa93e, 2);
      regs.x = regs.inc8(regs.x); m.step(0xa93f, 2);
      mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xa941, 5);
      if (regs.fN) { m.step(0xa943, 2); break; }
      m.step(0xa930, 3);
    }
  }
  // a943 (merge)
  regs.a = 0x2f; regs.setNZ(regs.a); m.step(0xa945, 2);
  regs.x = 0x60; regs.setNZ(regs.x); m.step(0xa947, 2);
  m.push16(0xa949); m.step(0xa94a, 6); m.call(0xdf39);
  regs.a = mem.read8(0x0123); regs.setNZ(regs.a); m.step(0xa94d, 4);
  // a94d bpl 0xa954 -- when $0123 negative, draw ab14 with X=0x36
  if (!regs.fN) {
    m.step(0xa954, 3);
  } else {
    m.step(0xa94f, 2);
    regs.x = 0x36; regs.setNZ(regs.x); m.step(0xa951, 2);
    m.push16(0xa953); m.step(0xa954, 6); m.call(0xab14);
  }
  // a954 (merge)
  regs.a = mem.read8(0x00); regs.setNZ(regs.a); m.step(0xa956, 3);
  regs.cmp(0x18); m.step(0xa958, 2);
  // a958 bne 0xa97c -> rts
  if (regs.fNZ) { m.step(0xa97c, 3); return m.ret(6); }
  m.step(0xa95a, 2);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xa95c, 3);
  // a95c bpl 0xa97c -> rts
  if (!regs.fN) { m.step(0xa97c, 3); return m.ret(6); }
  m.step(0xa95e, 2);
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xa960, 3);
  regs.a = mem.read8((0x0102 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa963, 4);
  // a963 beq 0xa972 -- when the slot is zero, skip the ab14/b0c6 pair
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
  // a972 (merge)
  regs.x = 0x3a; regs.setNZ(regs.x); m.step(0xa974, 2);
  m.push16(0xa976); m.step(0xa977, 6); m.call(0xab14);
  regs.x = 0x38; regs.setNZ(regs.x); m.step(0xa979, 2);
  m.push16(0xa97b); m.step(0xa97c, 6); m.call(0xab14);
  return m.ret(6);
}
