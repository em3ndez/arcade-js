// SPDX-License-Identifier: GPL-3.0-only
// loc_a7d2  (ROM 0xa7d2-0xa830) -- if $0115!=0: loop x=7..0 over table $03fe,x, remapping each nonzero
//   entry (clamp/wrap vs $0115 sign) and OR'ing the results into $29; if all became 0, clears $0115. All
//   branch targets are in-range -> modeled as JS control flow. Terminates in the single rts at a830.
export function loc_a7d2(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0115); regs.setNZ(regs.a); m.step(0xa7d5, 4);
  if (regs.fZ) { m.step(0xa830, 4); return m.ret(6); }
  m.step(0xa7d7, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa7d9, 2);
  mem.write8(0x29, regs.a); m.step(0xa7db, 3);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xa7dd, 2);
  mem.write8(0x37, regs.x); m.step(0xa7df, 3);

  do {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xa7e1, 3);
    { const addr = (0x03fe + regs.x) & 0xffff; regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xa7e4, 4 + ((addr & 0xff00) !== 0x0300 ? 1 : 0)); }
    if (regs.fZ) {
      m.step(0xa7fe, 3);
      regs.y = mem.read8(0x0115); regs.setNZ(regs.y); m.step(0xa801, 4);
      if (regs.fN) {
        m.step(0xa803, 2);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0xa804, 2);
        regs.clc(); m.step(0xa805, 2);
        regs.adc(0x01); m.step(0xa807, 2);
        regs.cmp(0x08); m.step(0xa809, 2);
        if (regs.fC) {
          m.step(0xa80b, 2);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa80d, 2);
        } else {
          m.step(0xa80d, 3);
        }
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa80e, 2);
        { const addr = (0x03fe + regs.y) & 0xffff; regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0xa811, 4 + ((addr & 0xff00) !== 0x0300 ? 1 : 0)); }
        if (regs.fZ) {
          m.step(0xa81e, 3);
        } else {
          m.step(0xa813, 2);
          regs.cmp(0xd5); m.step(0xa815, 2);
          if (regs.fC) {
            m.step(0xa81c, 3);
            regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa81e, 2);
          } else {
            m.step(0xa817, 2);
            regs.a = 0xf0; regs.setNZ(regs.a); m.step(0xa819, 2);
            regs.clv(); m.step(0xa81a, 2);
            m.step(0xa81e, 3);
          }
        }
      } else {
        m.step(0xa81e, 3);
      }
    } else {
      m.step(0xa7e6, 2);
      regs.sec(); m.step(0xa7e7, 2);
      regs.sbc(0x07); m.step(0xa7e9, 2);
      if (regs.fC) {
        m.step(0xa7eb, 2);
        regs.cmp(0x10); m.step(0xa7ed, 2);
      } else {
        m.step(0xa7ed, 3);
      }
      if (regs.fC) {
        m.step(0xa7fb, 3);
        regs.clv(); m.step(0xa7fc, 2);
        m.step(0xa81e, 4);
      } else {
        m.step(0xa7ef, 2);
        regs.y = mem.read8(0x0115); regs.setNZ(regs.y); m.step(0xa7f2, 4);
        if (regs.fN) {
          m.step(0xa7f4, 2);
          regs.a = 0xf0; regs.setNZ(regs.a); m.step(0xa7f6, 2);
          regs.clv(); m.step(0xa7f7, 2);
          m.step(0xa7fb, 3);
        } else {
          m.step(0xa7f9, 3);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa7fb, 2);
        }
        regs.clv(); m.step(0xa7fc, 2);
        m.step(0xa81e, 4);
      }
    }
    // a81e: convergence point -- A holds the remapped value, X still the loop counter
    mem.write8((0x03fe + regs.x) & 0xffff, regs.a); m.step(0xa821, 5);
    regs.ora(mem.read8(0x29)); m.step(0xa823, 3);
    mem.write8(0x29, regs.a); m.step(0xa825, 3);
    { const d = (mem.read8(0x37) - 1) & 0xff; mem.write8(0x37, d); regs.setNZ(d); } m.step(0xa827, 5);
    if (!regs.fN) { m.step(0xa7df, 4); }
    else { m.step(0xa829, 2); }
  } while (!regs.fN);

  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xa82b, 3);
  if (regs.fNZ) { m.step(0xa830, 3); return m.ret(6); }
  m.step(0xa82d, 2);
  mem.write8(0x0115, regs.a); m.step(0xa830, 4);
  return m.ret(6);
}
