// SPDX-License-Identifier: GPL-3.0-only
// loc_9b1e  (ROM 0x9b1e-0x9b97) -- if $0201>=0 (bmi skips), outer loop over $37 (init from $011c down to 0):
// for each nonzero $02df,x it inner-loops $010b calling loc_9b98 per 0xa0f7,y entry until $010a==0, storing
// $010b back to $0291,x. Then a signed accumulate of $0147 into $0148 (calls 0xcd06/0xcd02), clamped to
// [0x0f,0xc1] by negating $0147. abs,x/abs,y reads use base T (+1 on page cross, not modeled).
export function loc_9b1e(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0x9b21, 4);
  if (regs.fN) {
    m.step(0x9b56, 3);
  } else {
    m.step(0x9b23, 2);
    regs.x = mem.read8(0x011c); regs.setNZ(regs.x); m.step(0x9b26, 4);
    mem.write8(0x37, regs.x); m.step(0x9b28, 3);
    do {
      regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0x9b2a, 3);
      regs.a = mem.read8((0x02df + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9b2d, 4);
      if (regs.fNZ) {
        m.step(0x9b2f, 2);
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x9b31, 2);
        mem.write8(0x010a, regs.a); m.step(0x9b34, 4);
        regs.a = mem.read8((0x0291 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9b37, 4);
        mem.write8(0x010b, regs.a); m.step(0x9b3a, 4);
        do {
          regs.a = mem.read8(0x010b); regs.setNZ(regs.a); m.step(0x9b3d, 4);
          regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9b3e, 2);
          regs.a = mem.read8((0xa0f7 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9b41, 4);
          m.push16(0x9b43); m.step(0x9b44, 6); m.call(0x9b98);
          { const v = (mem.read8(0x010b) + 1) & 0xff; mem.write8(0x010b, v); regs.setNZ(v); m.step(0x9b47, 6); }
          regs.a = mem.read8(0x010a); regs.setNZ(regs.a); m.step(0x9b4a, 4);
          if (regs.fNZ) { m.step(0x9b3a, 3); continue; }
          m.step(0x9b4c, 2); break;
        } while (true);
        regs.a = mem.read8(0x010b); regs.setNZ(regs.a); m.step(0x9b4f, 4);
        mem.write8((0x0291 + regs.x) & 0xffff, regs.a); m.step(0x9b52, 5);
      } else {
        m.step(0x9b52, 3);
      }
      { const v = (mem.read8(0x37) - 1) & 0xff; mem.write8(0x37, v); regs.setNZ(v); m.step(0x9b54, 5); }
      if (regs.fN === false) { m.step(0x9b28, 3); continue; }
      m.step(0x9b56, 2); break;
    } while (true);
  }
  // ----- tail (9b56): signed accumulate of $0147 into $0148, then clamp -----
  L9b97: {
    L9b8c: {
      L9b88: {
        L9b7c: {
          L9b6f: {
            regs.a = mem.read8(0x0148); regs.setNZ(regs.a); m.step(0x9b59, 4);
            regs.clc(); m.step(0x9b5a, 2);
            regs.adc(mem.read8(0x0147)); m.step(0x9b5d, 4);
            regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9b5e, 2);
            regs.eor(mem.read8(0x0148)); m.step(0x9b61, 4);
            mem.write8(0x0148, regs.y); m.step(0x9b64, 4);
            if (regs.fN === false) { m.step(0x9b7c, 3); break L9b7c; }
            m.step(0x9b66, 2);
            regs.a = regs.y; regs.setNZ(regs.a); m.step(0x9b67, 2);
            if (regs.fN === false) { m.step(0x9b6f, 3); break L9b6f; }
            m.step(0x9b69, 2);
            m.push16(0x9b6b); m.step(0x9b6c, 6); m.call(0xcd06);
            regs.clv(); m.step(0x9b6d, 2);
            m.step(0x9b7c, 3); break L9b7c;
          }
          regs.a = mem.read8(0x0143); regs.setNZ(regs.a); m.step(0x9b72, 4);
          if (regs.fZ) { m.step(0x9b7c, 3); break L9b7c; }
          m.step(0x9b74, 2);
          regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0x9b77, 4);
          if (regs.fN) { m.step(0x9b7c, 3); break L9b7c; }
          m.step(0x9b79, 2);
          m.push16(0x9b7b); m.step(0x9b7c, 6); m.call(0xcd02);
        }
        regs.a = mem.read8(0x0148); regs.setNZ(regs.a); m.step(0x9b7f, 4);
        if (regs.fN) { m.step(0x9b88, 3); break L9b88; }
        m.step(0x9b81, 2);
        regs.cmp(0x0f); m.step(0x9b83, 2);
        if (regs.fC) { m.step(0x9b8c, 3); break L9b8c; }
        m.step(0x9b85, 2);
        regs.clv(); m.step(0x9b86, 2);
        m.step(0x9b97, 3); break L9b97;
      }
      regs.cmp(0xc1); m.step(0x9b8a, 2);
      if (regs.fC) { m.step(0x9b97, 3); break L9b97; }
      m.step(0x9b8c, 2);
    }
    regs.a = mem.read8(0x0147); regs.setNZ(regs.a); m.step(0x9b8f, 4);
    regs.eor(0xff); m.step(0x9b91, 2);
    regs.clc(); m.step(0x9b92, 2);
    regs.adc(0x01); m.step(0x9b94, 2);
    mem.write8(0x0147, regs.a); m.step(0x9b97, 4);
  }
  return m.ret(6);
}
