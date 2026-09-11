// SPDX-License-Identifier: GPL-3.0-only
// loc_9749  (ROM 0x9749-0x97c4) -- if $0201 negative returns; else clamps a spinner delta (from
// loc_97c5 or $50) into $2b/$2c, folds the 4 high bits to $2a, and if $2a changed calls loc_ccb5
// before storing $2a/$2b/$2c to $0200/$0201/$51. Forward branches only (clv/bvc = unconditional).
export function loc_9749(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0x974c, 4);
  if (!regs.fPl) {
    m.step(0x974e, 2);
    return m.ret(6);
  }
  m.step(0x974f, 3);
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0x9751, 2);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0x9753, 3);
  if (regs.fN) {
    m.step(0x975b, 3);
    regs.a = mem.read8(0x50); regs.setNZ(regs.a); m.step(0x975d, 3);
    if (regs.fPl) {
      m.step(0x9768, 3);
      regs.cmp(0x1f); m.step(0x976a, 2);
      if (regs.fNC) {
        m.step(0x976e, 3);
      } else {
        m.step(0x976c, 2);
        regs.a = 0x1f; regs.setNZ(regs.a); m.step(0x976e, 2);
      }
    } else {
      m.step(0x975f, 2);
      regs.cmp(0xe1); m.step(0x9761, 2);
      if (regs.fC) {
        m.step(0x9765, 3);
      } else {
        m.step(0x9763, 2);
        regs.a = 0xe1; regs.setNZ(regs.a); m.step(0x9765, 2);
      }
      regs.clv(); m.step(0x9766, 2);
      m.step(0x976e, 3);
    }
    mem.write8(0x50, regs.x); m.step(0x9770, 3);
  } else {
    m.step(0x9755, 2);
    m.push16(0x9757); m.step(0x9758, 6); m.call(0x97c5);
    regs.clv(); m.step(0x9759, 2);
    m.step(0x9770, 3);
  }
  mem.write8(0x2b, regs.a); m.step(0x9772, 3);
  regs.eor(0xff); m.step(0x9774, 2);
  regs.sec(); m.step(0x9775, 2);
  regs.adc(mem.read8(0x51)); m.step(0x9777, 3);
  mem.write8(0x2c, regs.a); m.step(0x9779, 3);
  regs.x = mem.read8(0x0111); regs.setNZ(regs.x); m.step(0x977c, 4);
  if (regs.fNZ) {
    m.step(0x977e, 2);
    regs.cmp(0xf0); m.step(0x9780, 2);
    if (regs.fC) {
      m.step(0x9782, 2);
      regs.a = 0xef; regs.setNZ(regs.a); m.step(0x9784, 2);
      mem.write8(0x2c, regs.a); m.step(0x9786, 3);
    } else {
      m.step(0x9786, 3);
    }
    regs.eor(mem.read8(0x2b)); m.step(0x9788, 3);
    if (regs.fN) {
      m.step(0x978a, 2);
      regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0x978c, 3);
      regs.eor(mem.read8(0x51)); m.step(0x978e, 3);
      if (regs.fN) {
        m.step(0x9790, 2);
        regs.a = mem.read8(0x51); regs.setNZ(regs.a); m.step(0x9792, 3);
        if (regs.fN) {
          m.step(0x9799, 3);
          regs.a = 0xef; regs.setNZ(regs.a); m.step(0x979b, 2);
        } else {
          m.step(0x9794, 2);
          regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9796, 2);
          regs.clv(); m.step(0x9797, 2);
          m.step(0x979b, 3);
        }
        mem.write8(0x2c, regs.a); m.step(0x979d, 3);
      } else {
        m.step(0x979d, 3);
      }
    } else {
      m.step(0x979d, 3);
    }
  } else {
    m.step(0x979d, 3);
  }
  regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0x979f, 3);
  regs.a = regs.lsr(regs.a); m.step(0x97a0, 2);
  regs.a = regs.lsr(regs.a); m.step(0x97a1, 2);
  regs.a = regs.lsr(regs.a); m.step(0x97a2, 2);
  regs.a = regs.lsr(regs.a); m.step(0x97a3, 2);
  mem.write8(0x2a, regs.a); m.step(0x97a5, 3);
  regs.clc(); m.step(0x97a6, 2);
  regs.adc(0x01); m.step(0x97a8, 2);
  regs.and(0x0f); m.step(0x97aa, 2);
  mem.write8(0x2b, regs.a); m.step(0x97ac, 3);
  regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0x97ae, 3);
  regs.cmp(mem.read8(0x0200)); m.step(0x97b1, 4);
  if (regs.fZ) {
    m.step(0x97b6, 3);
  } else {
    m.step(0x97b3, 2);
    m.push16(0x97b5); m.step(0x97b6, 6); m.call(0xccb5);
  }
  regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0x97b8, 3);
  mem.write8(0x0200, regs.a); m.step(0x97bb, 4);
  regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x97bd, 3);
  mem.write8(0x0201, regs.a); m.step(0x97c0, 4);
  regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0x97c2, 3);
  mem.write8(0x51, regs.a); m.step(0x97c4, 3);
  return m.ret(6);
}
