// SPDX-License-Identifier: GPL-3.0-only
// loc_dfb1  (ROM 0xdfb1-0xdfdb) -- loop $ae+1 times over a run of objects starting at index (A+Y-1): for
// each, emit its high nibble ($00,x>>4) via loc_df19, then its low nibble ($00,x) via loc_df19 (carry
// cleared on the last iter so the terminator bit differs), decrementing X and $ae; bpl loops, then rts.
export function loc_dfb1(m) {
  const { regs, mem } = m;
  regs.sec(); m.step(0xdfb2, 2);
  m.push8(regs.p); m.step(0xdfb3, 3);
  regs.y = regs.dec8(regs.y); m.step(0xdfb4, 2);
  mem.write8(0xae, regs.y); m.step(0xdfb6, 3);
  regs.clc(); m.step(0xdfb7, 2);
  regs.adc(mem.read8(0xae)); m.step(0xdfb9, 3);
  regs.p = m.pull8(); m.step(0xdfba, 4);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xdfbb, 2);
  while (true) {
    m.push8(regs.p); m.step(0xdfbc, 3);
    mem.write8(0xaf, regs.x); m.step(0xdfbe, 3);
    regs.a = mem.read8((0x00 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdfc0, 4);
    regs.a = regs.lsr(regs.a); m.step(0xdfc1, 2);
    regs.a = regs.lsr(regs.a); m.step(0xdfc2, 2);
    regs.a = regs.lsr(regs.a); m.step(0xdfc3, 2);
    regs.a = regs.lsr(regs.a); m.step(0xdfc4, 2);
    regs.p = m.pull8(); m.step(0xdfc5, 4);
    m.push16(0xdfc7); m.step(0xdfc8, 6); m.call(0xdf19);
    regs.a = mem.read8(0xae); regs.setNZ(regs.a); m.step(0xdfca, 3);
    if (regs.fNZ) { m.step(0xdfcd, 3); }
    else { m.step(0xdfcc, 2); regs.clc(); m.step(0xdfcd, 2); }
    regs.x = mem.read8(0xaf); regs.setNZ(regs.x); m.step(0xdfcf, 3);
    regs.a = mem.read8((0x00 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdfd1, 4);
    m.push16(0xdfd3); m.step(0xdfd4, 6); m.call(0xdf19);
    regs.x = mem.read8(0xaf); regs.setNZ(regs.x); m.step(0xdfd6, 3);
    regs.x = regs.dec8(regs.x); m.step(0xdfd7, 2);
    mem.write8(0xae, regs.dec8(mem.read8(0xae))); m.step(0xdfd9, 5);
    if (regs.fPl) { m.step(0xdfbb, 3); continue; }
    m.step(0xdfdb, 2); break;
  }
  return m.ret(6);
}
