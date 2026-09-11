// SPDX-License-Identifier: GPL-3.0-only
// loc_a5cb  (ROM 0xa5cb-0xa617) -- inits $00, sets $0106 bit7, clears $0104/$0107/$5c/$0123,
// $0105=2, counts nonzero $03ac..$03bb into $0123; if any set and $9f<7 loads a param block
// ($04=0x1e,$00=0x0a,$02=0x20,$0123=0x80); finally $0125=0xff; returns.
export function loc_a5cb(m) {
  const { regs, mem } = m;
  regs.a = 0x20; regs.setNZ(regs.a); m.step(0xa5cd, 2);
  mem.write8(0x00, regs.a); m.step(0xa5cf, 3);
  regs.a = mem.read8(0x0106); regs.setNZ(regs.a); m.step(0xa5d2, 4);
  regs.ora(0x80); m.step(0xa5d4, 2);
  mem.write8(0x0106, regs.a); m.step(0xa5d7, 4);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa5d9, 2);
  mem.write8(0x0104, regs.a); m.step(0xa5dc, 4);
  mem.write8(0x0107, regs.a); m.step(0xa5df, 4);
  mem.write8(0x5c, regs.a); m.step(0xa5e1, 3);
  mem.write8(0x0123, regs.a); m.step(0xa5e4, 4);
  regs.a = 0x02; regs.setNZ(regs.a); m.step(0xa5e6, 2);
  mem.write8(0x0105, regs.a); m.step(0xa5e9, 4);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xa5eb, 2);
  do {
    regs.a = mem.read8((0x03ac + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa5ee, 4);
    if (regs.fZ) {
      m.step(0xa5f3, 3);
    } else {
      m.step(0xa5f0, 2);
      mem.write8(0x0123, regs.inc8(mem.read8(0x0123))); m.step(0xa5f3, 6);
    }
    regs.x = regs.dec8(regs.x); m.step(0xa5f4, 2);
    if (regs.fPl) { m.step(0xa5eb, 3); continue; }
    m.step(0xa5f6, 2); break;
  } while (true);
  tail: {
    regs.a = mem.read8(0x0123); regs.setNZ(regs.a); m.step(0xa5f9, 4);
    if (regs.fZ) { m.step(0xa612, 3); break tail; }
    m.step(0xa5fb, 2);
    regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0xa5fd, 3);
    regs.cmp(0x07); m.step(0xa5ff, 2);
    if (regs.fC) { m.step(0xa612, 3); break tail; }
    m.step(0xa601, 2);
    regs.a = 0x1e; regs.setNZ(regs.a); m.step(0xa603, 2);
    mem.write8(0x04, regs.a); m.step(0xa605, 3);
    regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xa607, 2);
    mem.write8(0x00, regs.a); m.step(0xa609, 3);
    regs.a = 0x20; regs.setNZ(regs.a); m.step(0xa60b, 2);
    mem.write8(0x02, regs.a); m.step(0xa60d, 3);
    regs.a = 0x80; regs.setNZ(regs.a); m.step(0xa60f, 2);
    mem.write8(0x0123, regs.a); m.step(0xa612, 4);
  }
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa614, 2);
  mem.write8(0x0125, regs.a); m.step(0xa617, 4);
  return m.ret(6);
}
