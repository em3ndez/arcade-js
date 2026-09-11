// SPDX-License-Identifier: GPL-3.0-only
// loc_c235  (ROM 0xc235-0xc2e7) -- level-geometry setup. Calls loc_c2e8 with $46,x, stashes its A,
// derives $5f/$5d/$a0/$60/$0111 from the $bc8c/$bc9c/$bccc tables (by $0112), then either copies
// ($02==0x1e) or difference-computes ($02!=0x1e, a 4-step arithmetic shift-right into $0121) the
// $bcac/$bcbc pair. Loop 1 seeds the $03ce/$03de/$031a/$033a/$039a/$03ee arrays from the b9/ba/bb
// tables by the stashed A; loop 2 fills $0435/$0445 with the rotate-averaged $03ce/$03de neighbours.
export function loc_c235(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xc237, 3);
  regs.a = mem.read8((0x0046 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc239, 4);
  m.push16(0xc23b); m.step(0xc23c, 6); m.call(0xc2e8);
  m.push8(regs.a); m.step(0xc23d, 3);
  regs.y = mem.read8(0x0112); regs.setNZ(regs.y); m.step(0xc240, 4);
  regs.a = mem.read8((0xbc8c + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc243, 4);
  regs.eor(0xff); m.step(0xc245, 2);
  regs.clc(); m.step(0xc246, 2);
  regs.adc(0x01); m.step(0xc248, 2);
  mem.write8(0x5f, regs.a); m.step(0xc24a, 3);
  mem.write8(0x5d, regs.a); m.step(0xc24c, 3);
  regs.a = 0x10; regs.setNZ(0x10); m.step(0xc24e, 2);
  regs.sec(); m.step(0xc24f, 2);
  regs.sbc(mem.read8(0x5f)); m.step(0xc251, 3);
  mem.write8(0xa0, regs.a); m.step(0xc253, 3);
  regs.a = 0xff; regs.setNZ(0xff); m.step(0xc255, 2);
  mem.write8(0x5b, regs.a); m.step(0xc257, 3);
  regs.a = mem.read8((0xbc9c + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc25a, 4);
  mem.write8(0x60, regs.a); m.step(0xc25c, 3);
  regs.a = mem.read8((0xbccc + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc25f, 4);
  mem.write8(0x0111, regs.a); m.step(0xc262, 4);
  regs.a = mem.read8(0x02); regs.setNZ(regs.a); m.step(0xc264, 3);
  regs.cmp(0x1e); m.step(0xc266, 2);
  if (regs.fNZ) {
    m.step(0xc275, 3);
    regs.a = mem.read8((0xbcac + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc278, 4);
    regs.sec(); m.step(0xc279, 2);
    regs.sbc(mem.read8(0x68)); m.step(0xc27b, 3);
    mem.write8(0x0121, regs.a); m.step(0xc27e, 4);
    regs.a = mem.read8((0xbcbc + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc281, 4);
    regs.sbc(mem.read8(0x0069)); m.step(0xc284, 4);
    regs.x = 0x03; regs.setNZ(0x03); m.step(0xc286, 2);
    do {
      regs.a = regs.lsr(regs.a); m.step(0xc287, 2);
      mem.write8(0x0121, regs.ror(mem.read8(0x0121))); m.step(0xc28a, 6);
      regs.x = regs.dec8(regs.x); m.step(0xc28b, 2);
      if (regs.fPl) { m.step(0xc286, 3); } else { m.step(0xc28d, 2); break; }
    } while (true);
  } else {
    m.step(0xc268, 2);
    regs.a = mem.read8((0xbcac + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc26b, 4);
    mem.write8(0x68, regs.a); m.step(0xc26d, 3);
    regs.a = mem.read8((0xbcbc + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc270, 4);
    mem.write8(0x69, regs.a); m.step(0xc272, 3);
    regs.clv(); m.step(0xc273, 2);
    m.step(0xc28d, 3);
  }
  regs.a = 0x00; regs.setNZ(0x00); m.step(0xc28f, 2);
  mem.write8(0x66, regs.a); m.step(0xc291, 3);
  mem.write8(0x67, regs.a); m.step(0xc293, 3);
  regs.a = 0x00; regs.setNZ(0x00); m.step(0xc295, 2);
  mem.write8(0x010f, regs.a); m.step(0xc298, 4);
  mem.write8(0x0110, regs.a); m.step(0xc29b, 4);
  regs.a = 0x2c; regs.setNZ(0x2c); m.step(0xc29d, 2);
  mem.write8(0x0113, regs.a); m.step(0xc2a0, 4);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc2a1, 4);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xc2a2, 2);
  regs.x = 0x0f; regs.setNZ(0x0f); m.step(0xc2a4, 2);
  do {
    regs.a = mem.read8((0xb97c + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc2a7, 4);
    mem.write8((0x03ce + regs.x) & 0xffff, regs.a); m.step(0xc2aa, 5);
    regs.a = mem.read8((0xba7c + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc2ad, 4);
    mem.write8((0x03de + regs.x) & 0xffff, regs.a); m.step(0xc2b0, 5);
    regs.a = 0x00; regs.setNZ(0x00); m.step(0xc2b2, 2);
    mem.write8((0x031a + regs.x) & 0xffff, regs.a); m.step(0xc2b5, 5);
    mem.write8((0x033a + regs.x) & 0xffff, regs.a); m.step(0xc2b8, 5);
    mem.write8((0x039a + regs.x) & 0xffff, regs.a); m.step(0xc2bb, 5);
    regs.a = mem.read8((0xbb7c + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc2be, 4);
    mem.write8((0x03ee + regs.x) & 0xffff, regs.a); m.step(0xc2c1, 5);
    regs.y = regs.dec8(regs.y); m.step(0xc2c2, 2);
    regs.x = regs.dec8(regs.x); m.step(0xc2c3, 2);
    if (regs.fPl) { m.step(0xc2a4, 3); } else { m.step(0xc2c5, 2); break; }
  } while (true);
  regs.y = 0x00; regs.setNZ(0x00); m.step(0xc2c7, 2);
  regs.x = 0x0f; regs.setNZ(0x0f); m.step(0xc2c9, 2);
  do {
    regs.a = mem.read8((0x03ce + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc2cc, 4);
    regs.sec(); m.step(0xc2cd, 2);
    regs.adc(mem.read8((0x03ce + regs.x) & 0xffff)); m.step(0xc2d0, 4);
    regs.a = regs.ror(regs.a); m.step(0xc2d1, 2);
    mem.write8((0x0435 + regs.x) & 0xffff, regs.a); m.step(0xc2d4, 5);
    regs.a = mem.read8((0x03de + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc2d7, 4);
    regs.sec(); m.step(0xc2d8, 2);
    regs.adc(mem.read8((0x03de + regs.x) & 0xffff)); m.step(0xc2db, 4);
    regs.a = regs.ror(regs.a); m.step(0xc2dc, 2);
    mem.write8((0x0445 + regs.x) & 0xffff, regs.a); m.step(0xc2df, 5);
    regs.y = regs.dec8(regs.y); m.step(0xc2e0, 2);
    if (regs.fPl) { m.step(0xc2e4, 3); }
    else { m.step(0xc2e2, 2); regs.y = 0x0f; regs.setNZ(0x0f); m.step(0xc2e4, 2); }
    regs.x = regs.dec8(regs.x); m.step(0xc2e5, 2);
    if (regs.fPl) { m.step(0xc2c9, 3); } else { m.step(0xc2e7, 2); break; }
  } while (true);
  return m.ret(6);
}
