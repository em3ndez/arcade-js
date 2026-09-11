// SPDX-License-Identifier: GPL-3.0-only
// loc_c9f1  (ROM 0xc9f1-0xca17) -- scans $46,x for x=$3e..0 taking the max into $0126; if nonzero decrements it;
// then sets $00 to 0x14 or (when $05 negative) 0x10 and rts.
export function loc_c9f1(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc9f3, 2);
  mem.write8(0x0126, regs.a); m.step(0xc9f6, 4);
  regs.x = mem.read8(0x3e); regs.setNZ(regs.x); m.step(0xc9f8, 3);// c9f6 ldx $3e
  for (;;) {
    regs.a = mem.read8((0x46 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc9fa, 4);
    regs.cmp(mem.read8(0x0126)); m.step(0xc9fd, 4);
    if (regs.fNC) {
      m.step(0xca02, 3);
    } else {
      m.step(0xc9ff, 2);
      mem.write8(0x0126, regs.a); m.step(0xca02, 4);
    }
    regs.x = regs.dec8(regs.x); m.step(0xca03, 2);
    if (regs.fPl) { m.step(0xc9f8, 3); continue; }
    m.step(0xca05, 2);
    break;
  }
  regs.y = mem.read8(0x0126); regs.setNZ(regs.y); m.step(0xca08, 4);
  if (regs.fZ) {
    m.step(0xca0d, 3);
  } else {
    m.step(0xca0a, 2);
    mem.write8(0x0126, regs.dec8(mem.read8(0x0126))); m.step(0xca0d, 6);
  }
  regs.a = 0x14; regs.setNZ(regs.a); m.step(0xca0f, 2);
  regs.bit(mem.read8(0x05)); m.step(0xca11, 3);
  if (regs.fPl) {
    m.step(0xca15, 3);
  } else {
    m.step(0xca13, 2);
    regs.a = 0x10; regs.setNZ(regs.a); m.step(0xca15, 2);
  }
  mem.write8(0x00, regs.a); m.step(0xca17, 3);
  return m.ret(6);
}
