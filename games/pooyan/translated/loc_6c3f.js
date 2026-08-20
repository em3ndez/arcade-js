// SPDX-License-Identifier: GPL-3.0-only

// loc_6c3f  (ROM 0x6c3f-0x6caa) -- proximity test between the ix record and the iy record.
// Gated on bit0 of (hl). |(ix+0)+0x10 - ((iy+0)+0x20)| must be < 0x18 and the y-delta < 0x0e;
// on a hit it sets 0x8d54, picks an above/below indicator on 0x8a87 from (ix+2) and the y-sign,
// writes 0x8d52/0x8d53, then `pop af` discards its own return address so the closing `ret` returns
// to the caller's caller -- aborting the whole scan loop in loc_6c18.
export function loc_6c3f(m) {
  const { regs, mem } = m;

  // 0x6c86 shared tail: write C -> 0x8d52, 0x18 -> 0x8d53, drop own return, ret to grandparent.
  const tail86 = () => {
    regs.hl = 0x8d52;             m.step(0x6c89, 10);
    mem.write8(regs.hl, regs.c);  m.step(0x6c8a, 7);
    regs.l = regs.inc8(regs.l);   m.step(0x6c8b, 4);
    mem.write8(regs.hl, 0x18);    m.step(0x6c8d, 10);
    regs.af = m.pop16();          m.step(0x6c8e, 10);
    return m.ret(10);
  };
  // 0x6c93: indicator "below" (bit3=1,bit2=0), C=2, jr into the shared tail.
  const block93 = () => {
    mem.write8(regs.hl, regs.set(3, mem.read8(regs.hl))); m.step(0x6c95, 15);
    mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl))); m.step(0x6c97, 15);
    regs.c = 0x02;                m.step(0x6c99, 7);
    m.step(0x6c86, 12);          // jr 0x6c86
    return tail86();
  };

  regs.bit(0, mem.read8(regs.hl)); m.step(0x6c41, 12);
  if (regs.fZ) { return m.ret(11); } // ret z -- gate closed
  m.step(0x6c42, 5);
  regs.e = 0x10;                 m.step(0x6c44, 7);
  regs.d = 0x00;                 m.step(0x6c46, 7);
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x6c49, 19);
  regs.add(regs.e);             m.step(0x6c4a, 4);
  regs.e = regs.a;              m.step(0x6c4b, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x6c4e, 19);
  regs.add(regs.d);             m.step(0x6c4f, 4);
  regs.d = regs.a;              m.step(0x6c50, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x6c53, 19);
  regs.add(0x20);               m.step(0x6c55, 7);
  regs.sub(regs.e);             m.step(0x6c56, 4);
  if (regs.fNC) {
    m.step(0x6c5a, 12);
  } else {
    m.step(0x6c58, 7);
    regs.neg();                 m.step(0x6c5a, 8); // |x-delta|
  }
  regs.cp(0x18);                m.step(0x6c5c, 7);
  if (regs.fNC) { return m.ret(11); } // ret nc -- out of x-band
  m.step(0x6c5d, 5);
  regs.c = 0x00;                m.step(0x6c5f, 7);
  regs.a = mem.read8((regs.iy + 0x02) & 0xffff); m.step(0x6c62, 19);
  regs.add(0x08);               m.step(0x6c64, 7);
  regs.sub(regs.d);             m.step(0x6c65, 4);
  if (regs.fNC) {
    m.step(0x6c6b, 12);
  } else {
    m.step(0x6c67, 7);
    regs.c = 0xff;              m.step(0x6c69, 7); // y-delta negative
    regs.neg();                 m.step(0x6c6b, 8);
  }
  regs.cp(0x0e);                m.step(0x6c6d, 7);
  if (regs.fNC) { return m.ret(11); } // ret nc -- out of y-band
  m.step(0x6c6e, 5);

  // hit: mark 0x8d54, load A=(ix+2), point HL at the 0x8a87 indicator, C = y-sign+1.
  regs.hl = 0x8d54;             m.step(0x6c71, 10);
  mem.write8(regs.hl, 0x01);    m.step(0x6c73, 10);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x6c76, 19);
  regs.hl = 0x8a87;             m.step(0x6c79, 10);
  regs.c = regs.inc8(regs.c);   m.step(0x6c7a, 4);
  if (regs.fNZ) {
    m.step(0x6c8f, 12);         // y-delta >= 0
    regs.cp(0x51);              m.step(0x6c91, 7);
    if (regs.fNC) {
      m.step(0x6ca5, 12);       // indicator "above": bit2=1,bit3=0
      mem.write8(regs.hl, regs.set(2, mem.read8(regs.hl))); m.step(0x6ca7, 15);
      mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl))); m.step(0x6ca9, 15);
      regs.af = m.pop16();      m.step(0x6caa, 10);
      return m.ret(10);
    }
    m.step(0x6c93, 7);
    return block93();
  }
  m.step(0x6c7c, 7);            // y-delta < 0
  regs.cp(0xb6);               m.step(0x6c7e, 7);
  if (regs.fC) {
    m.step(0x6c9b, 12);
    regs.cp(0x51);             m.step(0x6c9d, 7);
    if (regs.fC) { m.step(0x6c93, 12); return block93(); }
    m.step(0x6c9f, 7);         // indicator "below" (no tail write)
    mem.write8(regs.hl, regs.set(3, mem.read8(regs.hl))); m.step(0x6ca1, 15);
    mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl))); m.step(0x6ca3, 15);
    regs.af = m.pop16();       m.step(0x6ca4, 10);
    return m.ret(10);
  }
  m.step(0x6c80, 7);           // indicator "above", C=1
  mem.write8(regs.hl, regs.set(2, mem.read8(regs.hl))); m.step(0x6c82, 15);
  mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl))); m.step(0x6c84, 15);
  regs.c = 0x01;               m.step(0x6c86, 7);
  return tail86();
}
