// SPDX-License-Identifier: GPL-3.0-only
// loc_a9d7  (ROM 0xa9d7-0xa9fb) -- loops 3x ($2a=2..0) over the ($3b) glyph pointer: emits the high
// nibble (carry preserved across via php/plp) and low byte through loc_a9fc, decrementing $3b each
// pass. Carry is cleared before the low-byte call only on the first pass ($2a!=0 skips the clc).
export function loc_a9d7(m) {
  const { regs, mem } = m;
  regs.y = 0x02; regs.setNZ(regs.y); m.step(0xa9d9, 2);
  mem.write8(0x2a, regs.y); m.step(0xa9db, 3);
  regs.sec(); m.step(0xa9dc, 2);
  do {
    m.push8(regs.p); m.step(0xa9dd, 3);
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa9df, 2);
    { const base = mem.read8(0x3b) | (mem.read8((0x3b + 1) & 0xff) << 8);
      regs.a = mem.read8((base + regs.y) & 0xffff); regs.setNZ(regs.a); } m.step(0xa9e1, 5);
    regs.a = regs.lsr(regs.a); m.step(0xa9e2, 2);
    regs.a = regs.lsr(regs.a); m.step(0xa9e3, 2);
    regs.a = regs.lsr(regs.a); m.step(0xa9e4, 2);
    regs.a = regs.lsr(regs.a); m.step(0xa9e5, 2);
    regs.p = m.pull8(); m.step(0xa9e6, 4);
    m.push16(0xa9e8); m.step(0xa9e9, 6); m.call(0xa9fc);
    regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0xa9eb, 3);
    // a9eb bne 0xa9ee
    if (regs.fNZ) {
      m.step(0xa9ee, 3);
    } else {
      m.step(0xa9ed, 2);
      regs.clc(); m.step(0xa9ee, 2);
    }
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xa9f0, 2);
    { const base = mem.read8(0x3b) | (mem.read8((0x3b + 1) & 0xff) << 8);
      regs.a = mem.read8((base + regs.y) & 0xffff); regs.setNZ(regs.a); } m.step(0xa9f2, 5);
    m.push16(0xa9f4); m.step(0xa9f5, 6); m.call(0xa9fc);
    mem.write8(0x3b, regs.dec8(mem.read8(0x3b))); m.step(0xa9f7, 5);
    mem.write8(0x2a, regs.dec8(mem.read8(0x2a))); m.step(0xa9f9, 5);
    // a9f9 bpl 0xa9dc
    if (regs.fPl) { m.step(0xa9dc, 3); } else { m.step(0xa9fb, 2); break; }
  } while (true);
  return m.ret(6);
}
