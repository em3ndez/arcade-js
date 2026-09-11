// SPDX-License-Identifier: GPL-3.0-only
// loc_b367  (ROM 0xb367-0xb475) -- rebuilds the 16-byte flag block $0425.. from enemy tables, then walks
// two 16-entry loops writing display state via (0x3b),y and merging color bits into (0xb0),y. Ends rts.
export function loc_b367(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0114); regs.setNZ(regs.a); m.step(0xb36a, 4);
  // b36a beq 0xb379
  if (regs.fZ) {
    m.step(0xb379, 3);
  } else {
    m.step(0xb36c, 2);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0xb36e, 2);
    m.push16(0xb370); m.step(0xb371, 6); m.call(0xb2be);
    m.push16(0xb373); m.step(0xb374, 6); m.call(0xc30d);
    regs.a = 0x02; regs.setNZ(regs.a); m.step(0xb376, 2);
    m.push16(0xb378); m.step(0xb379, 6); m.call(0xb2fe);
  }
  // b379
  regs.a = 0x02; regs.setNZ(regs.a); m.step(0xb37b, 2);
  m.push16(0xb37d); m.step(0xb37e, 6); m.call(0xb2de);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb380, 2);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xb382, 2);
  do {
    mem.write8((0x0425 + regs.x) & 0xffff, regs.a); m.step(0xb385, 5);
    regs.x = regs.dec8(regs.x); m.step(0xb386, 2);
    m.step(regs.fPl ? 0xb382 : 0xb388, regs.fPl ? 3 : 2);
  } while (regs.fPl);
  // b388
  regs.a = mem.read8(0x0106); regs.setNZ(regs.a); m.step(0xb38b, 4);
  // b38b bmi 0xb3d6
  if (regs.fN) {
    m.step(0xb3d6, 3);
  } else {
    m.step(0xb38d, 2);
    regs.x = mem.read8(0x011c); regs.setNZ(regs.x); m.step(0xb390, 4);
    do {
      regs.a = mem.read8((0x02df + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb393, 4);
      // b393 beq 0xb3d3
      if (regs.fZ) {
        m.step(0xb3d3, 3);
      } else {
        m.step(0xb395, 2);
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb397, 2);
        regs.a = mem.read8((0x0283 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb39a, 4);
        regs.and(0x07); m.step(0xb39c, 2);
        regs.cmp(0x01); m.step(0xb39e, 2);
        // b39e bne 0xb3d3
        if (regs.fNZ) {
          m.step(0xb3d3, 3);
        } else {
          m.step(0xb3a0, 2);
          regs.y = regs.inc8(regs.y); m.step(0xb3a1, 2);
          mem.write8(0x29, regs.y); m.step(0xb3a3, 3);
          regs.a = mem.read8((0x0283 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb3a6, 4);
          regs.and(0x80); m.step(0xb3a8, 2);
          // b3a8 bne 0xb3c6
          if (regs.fNZ) {
            m.step(0xb3c6, 3);
          } else {
            m.step(0xb3aa, 2);
            regs.a = mem.read8(0x0148); regs.setNZ(regs.a); m.step(0xb3ad, 4);
            // b3ad bmi 0xb3bb
            if (regs.fN) {
              m.step(0xb3bb, 3);
            } else {
              m.step(0xb3af, 2);
              regs.a = mem.read8((0x02df + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb3b2, 4);
              regs.cmp(mem.read8(0x0157)); m.step(0xb3b5, 4);
              // b3b5 bcs 0xb3bb
              if (regs.fC) {
                m.step(0xb3bb, 3);
              } else {
                m.step(0xb3b7, 2);
                mem.write8(0x29, regs.inc8(mem.read8(0x29))); m.step(0xb3b9, 5);
                mem.write8(0x29, regs.inc8(mem.read8(0x29))); m.step(0xb3bb, 5);
              }
            }
            // b3bb
            regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xb3bd, 3);
            regs.y = mem.read8((0x02cc + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xb3c0, 4);
            regs.ora(mem.read8((0x0425 + regs.y) & 0xffff)); m.step(0xb3c3, 4);
            mem.write8((0x0425 + regs.y) & 0xffff, regs.a); m.step(0xb3c6, 5);
          }
          // b3c6
          regs.y = mem.read8((0x02b9 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xb3c9, 4);
          regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xb3cb, 3);
          regs.ora(0x80); m.step(0xb3cd, 2);
          regs.ora(mem.read8((0x0425 + regs.y) & 0xffff)); m.step(0xb3d0, 4);
          mem.write8((0x0425 + regs.y) & 0xffff, regs.a); m.step(0xb3d3, 5);
        }
      }
      // b3d3
      regs.x = regs.dec8(regs.x); m.step(0xb3d4, 2);
      m.step(regs.fPl ? 0xb390 : 0xb3d6, regs.fPl ? 3 : 2);
    } while (regs.fPl);
  }
  // b3d6
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0xb3d8, 2);
  regs.y = mem.read8(0x0125); regs.setNZ(regs.y); m.step(0xb3db, 4);
  // b3db beq 0xb3e9
  if (regs.fZ) {
    m.step(0xb3e9, 3);
  } else {
    m.step(0xb3dd, 2);
    // b3dd bmi 0xb3e9
    if (regs.fN) {
      m.step(0xb3e9, 3);
    } else {
      m.step(0xb3df, 2);
      regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xb3e1, 3);
      regs.and(0x07); m.step(0xb3e3, 2);
      regs.cmp(0x07); m.step(0xb3e5, 2);
      // b3e5 bne 0xb3e9
      if (regs.fNZ) {
        m.step(0xb3e9, 3);
      } else {
        m.step(0xb3e7, 2);
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0xb3e9, 2);
      }
    }
  }
  // b3e9
  mem.write8(0x29, regs.a); m.step(0xb3eb, 3);
  regs.y = 0xff; regs.setNZ(regs.y); m.step(0xb3ed, 2);
  regs.x = 0xff; regs.setNZ(regs.x); m.step(0xb3ef, 2);
  mem.write8(0x2c, regs.x); m.step(0xb3f1, 3);
  regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0xb3f4, 4);
  // b3f4 beq 0xb401
  if (regs.fZ) {
    m.step(0xb401, 3);
  } else {
    m.step(0xb3f6, 2);
    regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xb3f9, 4);
    // b3f9 bmi 0xb401
    if (regs.fN) {
      m.step(0xb401, 3);
    } else {
      m.step(0xb3fb, 2);
      regs.x = mem.read8(0x0200); regs.setNZ(regs.x); m.step(0xb3fe, 4);
      regs.y = mem.read8(0x0201); regs.setNZ(regs.y); m.step(0xb401, 4);
    }
  }
  // b401
  mem.write8(0x2a, regs.x); m.step(0xb403, 3);
  mem.write8(0x2b, regs.y); m.step(0xb405, 3);
  regs.a = mem.read8(0x0124); regs.setNZ(regs.a); m.step(0xb408, 4);
  // b408 bmi 0xb412
  if (regs.fN) {
    m.step(0xb412, 3);
  } else {
    m.step(0xb40a, 2);
    regs.and(0x0e); m.step(0xb40c, 2);
    regs.a = regs.lsr(regs.a); m.step(0xb40d, 2);
    mem.write8(0x2c, regs.a); m.step(0xb40f, 3);
    mem.write8(0x0124, regs.dec8(mem.read8(0x0124))); m.step(0xb412, 6);
  }
  // b412
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xb414, 2);
  do {
    regs.y = 0x06; regs.setNZ(regs.y); m.step(0xb416, 2);
    regs.a = mem.read8((0x0425 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb419, 4);
    // b419 beq 0xb427
    if (regs.fNZ) {
      m.step(0xb41b, 2);
      regs.and(0x02); m.step(0xb41d, 2);
      // b41d beq 0xb424
      if (regs.fNZ) {
        m.step(0xb41f, 2);
        regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xb421, 3);
        regs.and(0x01); m.step(0xb423, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb424, 2);
      } else {
        m.step(0xb424, 3);
      }
      // b424
      regs.clv(); m.step(0xb425, 2);
      m.step(0xb44b, 3);
    } else {
      m.step(0xb427, 3);
      regs.cpx(mem.read8(0x2a)); m.step(0xb429, 3);
      // b429 beq 0xb42d
      if (regs.fZ) {
        m.step(0xb42d, 3);
      } else {
        m.step(0xb42b, 2);
        regs.cpx(mem.read8(0x2b)); m.step(0xb42d, 3);
      }
      // b42d bne 0xb434
      if (regs.fNZ) {
        m.step(0xb434, 3);
        regs.a = mem.read8(0x0124); regs.setNZ(regs.a); m.step(0xb437, 4);
        // b437 bmi 0xb449
        if (regs.fN) {
          m.step(0xb449, 3);
          regs.y = mem.read8(0x29); regs.setNZ(regs.y); m.step(0xb44b, 3);
        } else {
          m.step(0xb439, 2);
          regs.a = regs.x; regs.setNZ(regs.a); m.step(0xb43a, 2);
          regs.clc(); m.step(0xb43b, 2);
          regs.adc(mem.read8(0x2c)); m.step(0xb43d, 3);
          regs.and(0x07); m.step(0xb43f, 2);
          regs.cmp(0x07); m.step(0xb441, 2);
          // b441 bne 0xb445
          if (regs.fNZ) {
            m.step(0xb445, 3);
          } else {
            m.step(0xb443, 2);
            regs.a = 0x03; regs.setNZ(regs.a); m.step(0xb445, 2);
          }
          // b445
          regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb446, 2);
          regs.clv(); m.step(0xb447, 2);
          m.step(0xb44b, 3);
        }
      } else {
        m.step(0xb42f, 2);
        regs.y = 0x01; regs.setNZ(regs.y); m.step(0xb431, 2);
        regs.clv(); m.step(0xb432, 2);
        m.step(0xb44b, 3);
      }
    }
    // b44b
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0xb44c, 2);
    regs.y = mem.read8((0xb476 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xb44f, 4);
    mem.write8(((mem.read8(0x3b) | (mem.read8(0x3c) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb451, 6);
    regs.x = regs.dec8(regs.x); m.step(0xb452, 2);
    m.step(regs.fPl ? 0xb414 : 0xb454, regs.fPl ? 3 : 2);
  } while (regs.fPl);
  // b454
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xb456, 2);
  regs.bit(mem.read8(0x0111)); m.step(0xb459, 4);
  // b459 bpl 0xb45c
  if (regs.fPl) {
    m.step(0xb45c, 3);
  } else {
    m.step(0xb45b, 2);
    regs.x = regs.dec8(regs.x); m.step(0xb45c, 2);
  }
  do {
    regs.y = 0xc0; regs.setNZ(regs.y); m.step(0xb45e, 2);
    regs.a = mem.read8((0x0425 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xb461, 4);
    // b461 bpl 0xb465
    if (regs.fPl) {
      m.step(0xb465, 3);
    } else {
      m.step(0xb463, 2);
      regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb465, 2);
    }
    // b465
    mem.write8(0x58, regs.y); m.step(0xb467, 3);
    regs.y = mem.read8((0xb487 + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xb46a, 4);
    regs.a = mem.read8(((mem.read8(0xb0) | (mem.read8(0xb1) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xb46c, 5);
    regs.and(0x1f); m.step(0xb46e, 2);
    regs.ora(mem.read8(0x58)); m.step(0xb470, 3);
    mem.write8(((mem.read8(0xb0) | (mem.read8(0xb1) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xb472, 6);
    regs.x = regs.dec8(regs.x); m.step(0xb473, 2);
    m.step(regs.fPl ? 0xb45c : 0xb475, regs.fPl ? 3 : 2);
  } while (regs.fPl);
  // b475
  return m.ret(6);
}
