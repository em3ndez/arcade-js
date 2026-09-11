// SPDX-License-Identifier: GPL-3.0-only
// loc_ac3f  (ROM 0xac3f-0xad21) -- clears $05 bit6, opt jsr $ca62, jsr $ddfb, then a channel loop (X)
// that bubble-sorts the $0620/$061f/$061e (+$0520/$051f/$051e) tables down Y from 0xfd, counting passes
// into $0605 -> $0600,x; finishes an $0601 clamp + $0603 = ((~bit0 of $3d)<<2 | $3d) + 5, falls to loc_ad22.
export function loc_ac3f(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xac41, 3);
  regs.and(0xbf); m.step(0xac43, 2);
  mem.write8(0x05, regs.a); m.step(0xac45, 3);
  regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xac47, 3);
  regs.and(0x43); m.step(0xac49, 2);
  regs.cmp(0x40); m.step(0xac4b, 2);
  if (regs.fNZ) {
    m.step(0xac50, 3);
  } else {
    m.step(0xac4d, 2);
    m.push16(0xac4f); m.step(0xac50, 6); m.call(0xca62);
  }
  m.push16(0xac52); m.step(0xac53, 6); m.call(0xddfb);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xac55, 2);
  mem.write8(0x0601, regs.a); m.step(0xac58, 4);
  regs.x = mem.read8(0x3e); regs.setNZ(regs.x); m.step(0xac5a, 3);
  if (regs.fZ) {
    m.step(0xac5e, 3);
  } else {
    m.step(0xac5c, 2);
    regs.x = 0x03; regs.setNZ(regs.x); m.step(0xac5e, 2);
  }
  while (true) {
    regs.a = mem.read8((0x42 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xac60, 4);
    mem.write8(0x2c, regs.a); m.step(0xac62, 3);
    regs.a = mem.read8((0x41 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xac64, 4);
    mem.write8(0x2d, regs.a); m.step(0xac66, 3);
    regs.a = mem.read8((0x40 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xac68, 4);
    mem.write8(0x2e, regs.a); m.step(0xac6a, 3);
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0xac6b, 2);
    regs.and(0x01); m.step(0xac6d, 2);
    mem.write8(0x36, regs.a); m.step(0xac6f, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xac71, 2);
    mem.write8(0x2b, regs.a); m.step(0xac73, 3);
    regs.a = 0x1a; regs.setNZ(regs.a); m.step(0xac75, 2);
    mem.write8(0x2a, regs.a); m.step(0xac77, 3);
    mem.write8(0x29, regs.a); m.step(0xac79, 3);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xac7b, 2);
    mem.write8(0x0605, regs.a); m.step(0xac7e, 4);
    regs.y = 0xfd; regs.setNZ(regs.y); m.step(0xac80, 2);
    while (true) {
      { const ea = (0x0620 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xac83, 4 + ((ea & 0xff00) !== 0x0600 ? 1 : 0)); }
      regs.cmp(mem.read8(0x2c)); m.step(0xac85, 3);
      if (regs.fNZ) {
        m.step(0xac9b, 3);
      } else {
        m.step(0xac87, 2);
        { const ea = (0x061f + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xac8a, 4 + ((ea & 0xff00) !== 0x0600 ? 1 : 0)); }
        regs.cmp(mem.read8(0x2d)); m.step(0xac8c, 3);
        if (regs.fNZ) {
          m.step(0xac9b, 3);
        } else {
          m.step(0xac8e, 2);
          regs.cpy(0x52); m.step(0xac90, 2);
          if (regs.fNC) {
            m.step(0xac9a, 3);
            regs.sec(); m.step(0xac9b, 2);
          } else {
            m.step(0xac92, 2);
            { const ea = (0x061e + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xac95, 4 + ((ea & 0xff00) !== 0x0600 ? 1 : 0)); }
            regs.cmp(mem.read8(0x2e)); m.step(0xac97, 3);
            regs.clv(); m.step(0xac98, 2);
            m.step(0xac9b, 3);
          }
        }
      }
      if (regs.fC) {
        m.step(0xacec, 3);
      } else {
        m.step(0xac9d, 2);
        while (true) {
          regs.cpy(0xe8); m.step(0xac9f, 2);
          if (regs.fNC) {
            m.step(0xacbf, 3);
          } else {
            m.step(0xaca1, 2);
            regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xaca3, 3);
            { const ea = (0x051e + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xaca6, 4 + ((ea & 0xff00) !== 0x0500 ? 1 : 0)); }
            mem.write8((0x051e + regs.y) & 0xffff, regs.a); m.step(0xaca9, 5);
            mem.write8(0x29, regs.x); m.step(0xacab, 3);
            regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0xacad, 3);
            { const ea = (0x051f + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xacb0, 4 + ((ea & 0xff00) !== 0x0500 ? 1 : 0)); }
            mem.write8((0x051f + regs.y) & 0xffff, regs.a); m.step(0xacb3, 5);
            mem.write8(0x2a, regs.x); m.step(0xacb5, 3);
            regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0xacb7, 3);
            { const ea = (0x0520 + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xacba, 4 + ((ea & 0xff00) !== 0x0500 ? 1 : 0)); }
            mem.write8((0x0520 + regs.y) & 0xffff, regs.a); m.step(0xacbd, 5);
            mem.write8(0x2b, regs.x); m.step(0xacbf, 3);
          }
          regs.a = mem.read8(0x2d); regs.setNZ(regs.a); m.step(0xacc1, 3);
          { const ea = (0x061f + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xacc4, 4 + ((ea & 0xff00) !== 0x0600 ? 1 : 0)); }
          mem.write8((0x061f + regs.y) & 0xffff, regs.a); m.step(0xacc7, 5);
          mem.write8(0x2d, regs.x); m.step(0xacc9, 3);
          regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0xaccb, 3);
          { const ea = (0x0620 + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xacce, 4 + ((ea & 0xff00) !== 0x0600 ? 1 : 0)); }
          mem.write8((0x0620 + regs.y) & 0xffff, regs.a); m.step(0xacd1, 5);
          mem.write8(0x2c, regs.x); m.step(0xacd3, 3);
          regs.cpy(0x52); m.step(0xacd5, 2);
          if (regs.fNC) {
            m.step(0xace1, 3);
          } else {
            m.step(0xacd7, 2);
            regs.a = mem.read8(0x2e); regs.setNZ(regs.a); m.step(0xacd9, 3);
            { const ea = (0x061e + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xacdc, 4 + ((ea & 0xff00) !== 0x0600 ? 1 : 0)); }
            mem.write8((0x061e + regs.y) & 0xffff, regs.a); m.step(0xacdf, 5);
            mem.write8(0x2e, regs.x); m.step(0xace1, 3);
          }
          regs.cpy(0x55); m.step(0xace3, 2);
          if (regs.fNC) {
            m.step(0xace6, 3);
          } else {
            m.step(0xace5, 2);
            regs.y = regs.dec8(regs.y); m.step(0xace6, 2);
          }
          regs.y = regs.dec8(regs.y); m.step(0xace7, 2);
          regs.y = regs.dec8(regs.y); m.step(0xace8, 2);
          if (regs.fZ) { m.step(0xacea, 2); break; }
          m.step(0xac9d, 3);
        }
        regs.y = 0x02; regs.setNZ(regs.y); m.step(0xacec, 2);
      }
      mem.write8(0x0605, regs.inc8(mem.read8(0x0605))); m.step(0xacef, 6);
      regs.cpy(0x55); m.step(0xacf1, 2);
      if (regs.fNC) {
        m.step(0xacf4, 3);
      } else {
        m.step(0xacf3, 2);
        regs.y = regs.dec8(regs.y); m.step(0xacf4, 2);
      }
      regs.y = regs.dec8(regs.y); m.step(0xacf5, 2);
      regs.y = regs.dec8(regs.y); m.step(0xacf6, 2);
      if (regs.fZ) { m.step(0xacf8, 2); break; }
      m.step(0xac80, 3);
    }
    regs.x = mem.read8(0x36); regs.setNZ(regs.x); m.step(0xacfa, 3);
    regs.a = mem.read8(0x0605); regs.setNZ(regs.a); m.step(0xacfd, 4);
    mem.write8((0x0600 + regs.x) & 0xffff, regs.a); m.step(0xad00, 5);
    regs.x = regs.dec8(regs.x); m.step(0xad01, 2);
    if (regs.fN) { m.step(0xad06, 3); break; }
    m.step(0xac5e, 3);
  }
  regs.a = mem.read8(0x0601); regs.setNZ(regs.a); m.step(0xad09, 4);
  regs.cmp(mem.read8(0x0600)); m.step(0xad0c, 4);
  if (regs.fNC) {
    m.step(0xad15, 3);
  } else {
    m.step(0xad0e, 2);
    regs.cmp(0x63); m.step(0xad10, 2);
    if (regs.fC) {
      m.step(0xad15, 3);
    } else {
      m.step(0xad12, 2);
      mem.write8(0x0601, regs.inc8(mem.read8(0x0601))); m.step(0xad15, 6);
    }
  }
  regs.a = mem.read8(0x3d); regs.setNZ(regs.a); m.step(0xad17, 3);
  regs.eor(0x01); m.step(0xad19, 2);
  regs.a = regs.asl(regs.a); m.step(0xad1a, 2);
  regs.a = regs.asl(regs.a); m.step(0xad1b, 2);
  regs.ora(mem.read8(0x3d)); m.step(0xad1d, 3);
  regs.adc(0x05); m.step(0xad1f, 2);
  mem.write8(0x0603, regs.a); m.step(0xad22, 4);
  return m.call(0xad22);
}
