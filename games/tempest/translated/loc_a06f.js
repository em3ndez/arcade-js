// SPDX-License-Identifier: GPL-3.0-only
// loc_a06f  (ROM 0xa06f-0xa0f6) -- clears slot $02df,y (saved to $29): decrements $0108 or $0109 depending
// on $0202 match and ($0283,y & 7)!=4, decrements $0142,x (x from $0283,y & 7). Then if ($028a,y & 3) sets
// up $2b/$2a and calls loc_9b07 + 0x994d twice to draw. abs,x/abs,y reads use base T (+1 page cross, unmodeled).
export function loc_a06f(m) {
  const { regs, mem } = m;
  L_a0f6: {
    L_a08b: {
      L_a088: {
        regs.a = mem.read8((0x02df + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa072, 4);
        mem.write8(0x29, regs.a); m.step(0xa074, 3);
        regs.cmp(mem.read8(0x0202)); m.step(0xa077, 4);
        if (regs.fNZ) { m.step(0xa088, 3); break L_a088; }
        m.step(0xa079, 2);
        regs.a = mem.read8((0x0283 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa07c, 4);
        regs.and(0x07); m.step(0xa07e, 2);
        regs.cmp(0x04); m.step(0xa080, 2);
        if (regs.fZ) { m.step(0xa088, 3); break L_a088; }
        m.step(0xa082, 2);
        { const v = (mem.read8(0x0109) - 1) & 0xff; mem.write8(0x0109, v); regs.setNZ(v); m.step(0xa085, 6); }
        regs.clv(); m.step(0xa086, 2);
        m.step(0xa08b, 3); break L_a08b;
      }
      { const v = (mem.read8(0x0108) - 1) & 0xff; mem.write8(0x0108, v); regs.setNZ(v); m.step(0xa08b, 6); }
    }
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa08d, 2);
    mem.write8((0x02df + regs.y) & 0xffff, regs.a); m.step(0xa090, 5);
    regs.a = mem.read8((0x0283 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa093, 4);
    regs.and(0x07); m.step(0xa095, 2);
    mem.write8(0x35, regs.x); m.step(0xa097, 3);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xa098, 2);
    { const v = (mem.read8((0x0142 + regs.x) & 0xffff) - 1) & 0xff; mem.write8((0x0142 + regs.x) & 0xffff, v); regs.setNZ(v); m.step(0xa09b, 7); }
    regs.x = mem.read8(0x35); regs.setNZ(regs.x); m.step(0xa09d, 3);
    regs.a = mem.read8((0x028a + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa0a0, 4);
    regs.and(0x03); m.step(0xa0a2, 2);
    if (regs.fZ) { m.step(0xa0f6, 3); break L_a0f6; }
    m.step(0xa0a4, 2);
    L_a0ad: {
      regs.sec(); m.step(0xa0a5, 2);
      regs.sbc(0x01); m.step(0xa0a7, 2);
      regs.cmp(0x02); m.step(0xa0a9, 2);
      if (regs.fNZ) { m.step(0xa0ad, 3); break L_a0ad; }
      m.step(0xa0ab, 2);
      regs.a = 0x04; regs.setNZ(regs.a); m.step(0xa0ad, 2);
    }
    mem.write8(0x2b, regs.a); m.step(0xa0af, 3);
    L_a0c2: {
      regs.a = mem.read8((0x02b9 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa0b2, 4);
      regs.sec(); m.step(0xa0b3, 2);
      regs.sbc(0x01); m.step(0xa0b5, 2);
      regs.and(0x0f); m.step(0xa0b7, 2);
      regs.cmp(0x0f); m.step(0xa0b9, 2);
      if (regs.fNC) { m.step(0xa0c2, 3); break L_a0c2; }
      m.step(0xa0bb, 2);
      regs.bit(mem.read8(0x0111)); m.step(0xa0be, 4);
      if (regs.fN === false) { m.step(0xa0c2, 3); break L_a0c2; }
      m.step(0xa0c0, 2);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa0c2, 2);
    }
    mem.write8(0x2a, regs.a); m.step(0xa0c4, 3);
    m.push16(0xa0c6); m.step(0xa0c7, 6); m.call(0x9b07);
    regs.a = mem.read8(0x2d); regs.setNZ(regs.a); m.step(0xa0c9, 3);
    mem.write8(0x010b, regs.a); m.step(0xa0cc, 4);
    { const v = (mem.read8(0x010b) - 1) & 0xff; mem.write8(0x010b, v); regs.setNZ(v); m.step(0xa0cf, 6); }
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa0d1, 2);
    mem.write8(0x010a, regs.a); m.step(0xa0d4, 4);
    m.push16(0xa0d6); m.step(0xa0d7, 6); m.call(0x994d);
    if (regs.fZ) { m.step(0xa0f6, 3); break L_a0f6; }
    m.step(0xa0d9, 2);
    L_a0eb: {
      regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0xa0db, 3);
      regs.clc(); m.step(0xa0dc, 2);
      regs.adc(0x02); m.step(0xa0de, 2);
      regs.and(0x0f); m.step(0xa0e0, 2);
      regs.cmp(0x0f); m.step(0xa0e2, 2);
      if (regs.fNZ) { m.step(0xa0eb, 3); break L_a0eb; }
      m.step(0xa0e4, 2);
      regs.bit(mem.read8(0x0111)); m.step(0xa0e7, 4);
      if (regs.fN === false) { m.step(0xa0eb, 3); break L_a0eb; }
      m.step(0xa0e9, 2);
      regs.a = 0x0e; regs.setNZ(regs.a); m.step(0xa0eb, 2);
    }
    mem.write8(0x2a, regs.a); m.step(0xa0ed, 3);
    regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0xa0ef, 3);
    regs.ora(0x40); m.step(0xa0f1, 2);
    mem.write8(0x2b, regs.a); m.step(0xa0f3, 3);
    m.push16(0xa0f5); m.step(0xa0f6, 6); m.call(0x994d);
  }
  return m.ret(6);
}
