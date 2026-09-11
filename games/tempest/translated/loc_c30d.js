// SPDX-License-Identifier: GPL-3.0-only
// loc_c30d  (ROM 0xc30d-0xc36d) -- init/dispatch: if $0110==0 seeds $57/$0110/$010f via calls to $c473/$c453,
// calls $df6a; returns early unless $0110 && $0113; else clears 16 slots via $c3ee loop, sets up $9e/$df4c,
// then falls through into loc_c36e with A=$0110 (later A=$010f). Contains JSRs to $c473 $c453 $df6a $c3ee $df4c $c36e.
export function loc_c30d(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0110); regs.setNZ(regs.a); m.step(0xc310, 4);
  if (!regs.fZ) {
    m.step(0xc339, 3);
  } else {
    m.step(0xc312, 2);
    regs.a = 0xf0; regs.setNZ(regs.a); m.step(0xc314, 2);
    mem.write8(0x57, regs.a); m.step(0xc316, 3);
    regs.x = 0x4f; regs.setNZ(regs.x); m.step(0xc318, 2);
    m.push16((0xc318 + 2) & 0xffff); m.step(0xc31b, 6); m.call(0xc473);
    mem.write8(0x0110, regs.a); m.step(0xc31e, 4);
    if (regs.fZ) {
      m.step(0xc323, 3);
    } else {
      m.step(0xc320, 2);
      mem.write8(0x010f, regs.a); m.step(0xc323, 4);
    }
    regs.a = mem.read8(0x010f); regs.setNZ(regs.a); m.step(0xc326, 4);
    if (!regs.fZ) {
      m.step(0xc339, 3);
    } else {
      m.step(0xc328, 2);
      regs.a = 0x10; regs.setNZ(regs.a); m.step(0xc32a, 2);
      mem.write8(0x57, regs.a); m.step(0xc32c, 3);
      m.push16((0xc32c + 2) & 0xffff); m.step(0xc32f, 6); m.call(0xc453);
      regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xc331, 3);
      regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xc333, 2);
      m.push16((0xc333 + 2) & 0xffff); m.step(0xc336, 6); m.call(0xc473);
      mem.write8(0x010f, regs.a); m.step(0xc339, 4);
    }
  }
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xc33b, 2);
  m.push16((0xc33b + 2) & 0xffff); m.step(0xc33e, 6); m.call(0xdf6a);
  regs.y = 0x06; regs.setNZ(regs.y); m.step(0xc340, 2);
  mem.write8(0x9e, regs.y); m.step(0xc342, 3);
  regs.x = mem.read8(0x0110); regs.setNZ(regs.x); m.step(0xc345, 4);
  if (regs.fZ) {
    m.step(0xc348, 3);
  } else {
    m.step(0xc347, 2);
    return m.ret(6);
  }
  regs.x = mem.read8(0x0113); regs.setNZ(regs.x); m.step(0xc34b, 4);
  if (regs.fZ) {
    m.step(0xc34d, 2);
    return m.ret(6);
  }
  m.step(0xc34e, 3);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xc350, 2);
  while (true) {
    regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xc352, 2);
    m.push16((0xc352 + 2) & 0xffff); m.step(0xc355, 6); m.call(0xc3ee);
    regs.x = regs.dec8(regs.x); m.step(0xc356, 2);
    if (!regs.fN) { m.step(0xc350, 3); continue; }
    m.step(0xc358, 2); break;
  }
  regs.y = 0x06; regs.setNZ(regs.y); m.step(0xc35a, 2);
  mem.write8(0x9e, regs.y); m.step(0xc35c, 3);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xc35e, 2);
  m.push16((0xc35e + 2) & 0xffff); m.step(0xc361, 6); m.call(0xdf4c);
  regs.y = 0x4f; regs.setNZ(regs.y); m.step(0xc363, 2);
  regs.a = mem.read8(0x0110); regs.setNZ(regs.a); m.step(0xc366, 4);
  m.push16((0xc366 + 2) & 0xffff); m.step(0xc369, 6); m.call(0xc36e);
  regs.y = 0x0f; regs.setNZ(regs.y); m.step(0xc36b, 2);
  regs.a = mem.read8(0x010f); regs.setNZ(regs.a); m.step(0xc36e, 4);
  return m.call(0xc36e);
}
