// SPDX-License-Identifier: GPL-3.0-only
// loc_b8ba  (ROM 0xb8ba-0xb943) -- clears $68-$6d/$0202, seeds $5f/$5b, then loops index $37 from 0x0f down,
// drawing each active entry ($0283,x!=0) via a chain of jsr helpers, and falls through into loc_b944.
export function loc_b8ba(m) {
  const { regs, mem } = m;
  regs.a = 0x3f; regs.setNZ(regs.a); m.step(0xb8bc, 2);
  regs.x = 0xf2; regs.setNZ(regs.x); m.step(0xb8be, 2);
  m.push16(0xb8c0); m.step(0xb8c1, 6); m.call(0xdf39);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb8c3, 2);
  mem.write8(0x6a, regs.a); m.step(0xb8c5, 3);
  mem.write8(0x6b, regs.a); m.step(0xb8c7, 3);
  mem.write8(0x6c, regs.a); m.step(0xb8c9, 3);
  mem.write8(0x6d, regs.a); m.step(0xb8cb, 3);
  mem.write8(0x0202, regs.a); m.step(0xb8ce, 4);
  mem.write8(0x68, regs.a); m.step(0xb8d0, 3);
  mem.write8(0x69, regs.a); m.step(0xb8d2, 3);
  regs.a = 0xe0; regs.setNZ(regs.a); m.step(0xb8d4, 2);
  mem.write8(0x5f, regs.a); m.step(0xb8d6, 3);
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xb8d8, 2);
  mem.write8(0x5b, regs.a); m.step(0xb8da, 3);
  m.push16(0xb8dc); m.step(0xb8dd, 6); m.call(0xb967);
  mem.write8(0x77, regs.a); m.step(0xb8df, 3);
  mem.write8(0x76, regs.x); m.step(0xb8e1, 3);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xb8e3, 2);
  mem.write8(0x37, regs.x); m.step(0xb8e5, 3);
  while (true) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xb8e7, 3);
    regs.a = mem.read8((0x0283 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb8ea, 4);
    if (regs.fZ) {
      m.step(0xb935, 3);
    } else {
      m.step(0xb8ec, 2);
      mem.write8(0x57, regs.a); m.step(0xb8ee, 3);
      regs.a = mem.read8((0x0263 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb8f1, 4);
      mem.write8(0x56, regs.a); m.step(0xb8f3, 3);
      regs.a = mem.read8((0x02a3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb8f6, 4);
      mem.write8(0x58, regs.a); m.step(0xb8f8, 3);
      m.push16(0xb8fa); m.step(0xb8fb, 6); m.call(0xc098);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb8fd, 2);
      mem.write8(0x73, regs.a); m.step(0xb8ff, 3);
      m.push16(0xb901); m.step(0xb902, 6); m.call(0xb944);
      m.push16(0xb904); m.step(0xb905, 6); m.call(0xc3ba);
      regs.a = 0xa0; regs.setNZ(regs.a); m.step(0xb907, 2);
      m.push16(0xb909); m.step(0xb90a, 6); m.call(0xb56a);
      m.push16(0xb90c); m.step(0xb90d, 6); m.call(0xb944);
      regs.x = 0x61; regs.setNZ(regs.x); m.step(0xb90f, 2);
      m.push16(0xb911); m.step(0xb912, 6); m.call(0xc772);
      m.push16(0xb914); m.step(0xb915, 6); m.call(0xb955);
      m.push16(0xb917); m.step(0xb918, 6); m.call(0xdf6c);
      regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xb91a, 3);
      regs.and(0x07); m.step(0xb91c, 2);
      regs.cmp(0x07); m.step(0xb91e, 2);
      if (regs.fNZ) {
        m.step(0xb922, 3);
      } else {
        m.step(0xb920, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb922, 2);
      }
      regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb923, 2);
      mem.write8(0x9e, regs.y); m.step(0xb925, 3);
      regs.a = 0x08; regs.setNZ(regs.a); m.step(0xb927, 2);
      m.push16(0xb929); m.step(0xb92a, 6); m.call(0xdf4c);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb92c, 2);
      m.push16(0xb92e); m.step(0xb92f, 6); m.call(0xdf4a);
      m.push16(0xb931); m.step(0xb932, 6); m.call(0xb967);
      m.push16(0xb934); m.step(0xb935, 6); m.call(0xdf39);
    }
    const v = (mem.read8(0x37) - 1) & 0xff; mem.write8(0x37, v); regs.setNZ(v); m.step(0xb937, 5);
    if (!regs.fN) { m.step(0xb8e5, 3); continue; }
    m.step(0xb939, 2); break;
  }
  m.push16(0xb93b); m.step(0xb93c, 6); m.call(0xb944);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xb93e, 2);
  m.push16(0xb940); m.step(0xb941, 6); m.call(0xdf6a);
  m.push16(0xb943); m.step(0xb944, 6); m.call(0xdf09);
  return m.call(0xb944);
}
