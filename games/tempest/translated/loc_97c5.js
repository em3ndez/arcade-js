// SPDX-License-Identifier: GPL-3.0-only
// loc_97c5  (ROM 0x97c5-0x97f7) -- scans $02df[0..$011c] for the smallest non-zero entry, keeping
// its index in $2a; if none, returns. Else looks up $02b9[idx], calls loc_a7a6 with $0200, and
// returns A = 0x09 (result negative) / 0xf7 (positive) / callee's A (zero).
export function loc_97c5(m) {
  const { regs, mem } = m;
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x97c7, 2);
  mem.write8(0x29, regs.a); m.step(0x97c9, 3);
  mem.write8(0x2a, regs.a); m.step(0x97cb, 3);
  regs.x = mem.read8(0x011c); regs.setNZ(regs.x); m.step(0x97ce, 4);
  do {
    regs.a = mem.read8((0x02df + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x97d1, 4);
    if (regs.fNZ) {
      m.step(0x97d3, 2);
      regs.cmp(mem.read8(0x29)); m.step(0x97d5, 3);
      if (!regs.fC) {
        m.step(0x97d7, 2);
        mem.write8(0x29, regs.a); m.step(0x97d9, 3);
        mem.write8(0x2a, regs.x); m.step(0x97db, 3);
      } else {
        m.step(0x97db, 3);
      }
    } else {
      m.step(0x97db, 3);
    }
    regs.x = regs.dec8(regs.x); m.step(0x97dc, 2);
    if (regs.fPl) {
      m.step(0x97ce, 3);
    } else {
      m.step(0x97de, 2);
      break;
    }
  } while (true);
  regs.x = mem.read8(0x2a); regs.setNZ(regs.x); m.step(0x97e0, 3);
  if (regs.fN) {
    m.step(0x97f7, 3);
    return m.ret(6);
  }
  m.step(0x97e2, 2);
  regs.a = mem.read8((0x02b9 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x97e5, 4);
  regs.y = mem.read8(0x0200); regs.setNZ(regs.y); m.step(0x97e8, 4);
  m.push16(0x97ea); m.step(0x97eb, 6); m.call(0xa7a6);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x97ec, 2);
  if (regs.fZ) {
    m.step(0x97f7, 3);
    return m.ret(6);
  }
  m.step(0x97ee, 2);
  if (regs.fN) {
    m.step(0x97f5, 3);
    regs.a = 0x09; regs.setNZ(regs.a); m.step(0x97f7, 2);
  } else {
    m.step(0x97f0, 2);
    regs.a = 0xf7; regs.setNZ(regs.a); m.step(0x97f2, 2);
    regs.clv(); m.step(0x97f3, 2);
    m.step(0x97f7, 3);
  }
  return m.ret(6);
}
