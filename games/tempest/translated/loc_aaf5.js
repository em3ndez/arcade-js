// SPDX-License-Identifier: GPL-3.0-only
// loc_aaf5  (ROM 0xaaf5-0xab0c) -- BCD (sed) routine: stashes A in $29, then 8x { asl $29; $2c += $2c }
// (a shift-and-double loop counted by Y=7..0), clears decimal, stores A back to $29, rts.
export function loc_aaf5(m) {
  const { regs, mem } = m;
  regs.sed(); m.step(0xaaf6, 2);
  mem.write8(0x29, regs.a); m.step(0xaaf8, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xaafa, 2);
  mem.write8(0x2c, regs.a); m.step(0xaafc, 3);
  regs.y = 0x07; regs.setNZ(regs.y); m.step(0xaafe, 2);
  do {
    mem.write8(0x29, regs.asl(mem.read8(0x29))); m.step(0xab00, 5);
    regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0xab02, 3);
    regs.adc(mem.read8(0x2c)); m.step(0xab04, 3);
    mem.write8(0x2c, regs.a); m.step(0xab06, 3);
    regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0xab07, 2);
    if (regs.fN) { m.step(0xab09, 2); break; }
    m.step(0xaafe, 4);
  } while (true);
  regs.cld(); m.step(0xab0a, 2);
  mem.write8(0x29, regs.a); m.step(0xab0c, 3);
  return m.ret(6);
}
