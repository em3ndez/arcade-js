// SPDX-License-Identifier: GPL-3.0-only
// loc_98a2  (ROM 0x98a2-0x9922) -- builds a per-slot flag mask in $014f/$0150 by scanning the 0x40-entry
// $0243 timer table (x=0x3f..0), decrementing/aging each slot (jsr $9923 on expiry), gating on $2f (bit
// test) and a $ca38,y lookup table; result written to $0150. In-range branches modelled as JS flow.
export function loc_98a2(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x98a4, 2);
  mem.write8(0x014f, regs.y); m.step(0x98a7, 4);
  regs.a = mem.read8(0x0108); regs.setNZ(regs.a); m.step(0x98aa, 4);
  regs.clc(); m.step(0x98ab, 2);
  regs.adc(mem.read8(0x0109)); m.step(0x98ae, 4);
  regs.cmp(mem.read8(0x011c)); m.step(0x98b1, 4);
  if (regs.fNC) {
    m.step(0x98b7, 3);
  } else {
    m.step(0x98b3, 2);
    if (regs.fZ) {
      m.step(0x98b7, 3);
    } else {
      m.step(0x98b5, 2);
      regs.y = 0xff; regs.setNZ(regs.y); m.step(0x98b7, 2);
    }
  }
  regs.a = mem.read8(0x0125); regs.setNZ(regs.a); m.step(0x98ba, 4);
  if (regs.fZ) {
    m.step(0x98be, 3);
  } else {
    m.step(0x98bc, 2);
    regs.y = 0xff; regs.setNZ(regs.y); m.step(0x98be, 2);
  }
  mem.write8(0x2f, regs.y); m.step(0x98c0, 3);
  regs.x = 0x3f; regs.setNZ(regs.x); m.step(0x98c2, 2);
  while (true) {
    let toBottom = false;
    regs.a = mem.read8((0x0243 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x98c5, 4);
    if (regs.fZ) { m.step(0x9919, 4); toBottom = true; }
    if (!toBottom) {
      body98c7: {
        m.step(0x98c7, 2);
        regs.bit(mem.read8(0x2f)); m.step(0x98c9, 3);
        if (regs.fN) { m.step(0x98ee, 3); break body98c7; }
        m.step(0x98cb, 2);
        regs.sec(); m.step(0x98cc, 2);
        regs.sbc(0x01); m.step(0x98ce, 2);
        mem.write8((0x0243 + regs.x) & 0xffff, regs.a); m.step(0x98d1, 5);
        if (regs.fZ) {
          m.step(0x98d3, 2);
          m.push16(0x98d5); m.step(0x98d6, 6); m.call(0x9923);
          regs.clv(); m.step(0x98d7, 2);
          m.step(0x98ee, 3); break body98c7;
        }
        m.step(0x98d9, 3);
        regs.cmp(0x3f); m.step(0x98db, 2);
        if (regs.fNZ) { m.step(0x98ee, 3); break body98c7; }
        m.step(0x98dd, 2);
        regs.y = mem.read8((0x0203 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0x98e0, 4);
        regs.a = mem.read8(0x014f); regs.setNZ(regs.a); m.step(0x98e3, 4);
        regs.ora(mem.read8(0x014f)); m.step(0x98e6, 4);
        regs.and(mem.read8((0xca38 + regs.y) & 0xffff)); m.step(0x98e9, 4);
        if (regs.fZ) { m.step(0x98ee, 3); break body98c7; }
        m.step(0x98eb, 2);
        { const v = (mem.read8((0x0243 + regs.x) & 0xffff) + 1) & 0xff; mem.write8((0x0243 + regs.x) & 0xffff, v); regs.setNZ(v); } m.step(0x98ee, 7);
      }
      // 98ee block (convergence)
      regs.a = mem.read8((0x0243 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x98f1, 4);
      regs.cmp(0x40); m.step(0x98f3, 2);
      if (regs.fNC) {
        m.step(0x9909, 4);
        regs.cmp(0x20); m.step(0x990b, 2);
        if (regs.fNC) {
          m.step(0x9919, 3);
        } else {
          m.step(0x990d, 2);
          regs.y = mem.read8((0x0203 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0x9910, 4);
          regs.a = mem.read8((0xca38 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9913, 4);
          regs.ora(mem.read8(0x014f)); m.step(0x9916, 4);
          mem.write8(0x014f, regs.a); m.step(0x9919, 4);
        }
      } else {
        m.step(0x98f5, 2);
        regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0x98f7, 3);
        regs.and(0x01); m.step(0x98f9, 2);
        if (regs.fNZ) {
          m.step(0x9906, 4);
        } else {
          m.step(0x98fb, 2);
          regs.a = mem.read8((0x0203 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x98fe, 4);
          regs.clc(); m.step(0x98ff, 2);
          regs.adc(0x01); m.step(0x9901, 2);
          regs.and(0x0f); m.step(0x9903, 2);
          mem.write8((0x0203 + regs.x) & 0xffff, regs.a); m.step(0x9906, 5);
        }
        regs.clv(); m.step(0x9907, 2);
        m.step(0x9919, 3);
      }
    }
    // 9919 dex; bpl 0x98c2
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x991a, 2);
    if (!regs.fN) { m.step(0x98c2, 4); continue; }
    m.step(0x991c, 2); break;
  }
  regs.a = mem.read8(0x014f); regs.setNZ(regs.a); m.step(0x991f, 4);
  mem.write8(0x0150, regs.a); m.step(0x9922, 4);
  return m.ret(6);
}
