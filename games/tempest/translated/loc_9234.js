// SPDX-License-Identifier: GPL-3.0-only
// loc_9234  (ROM 0x9234-0x9245) -- $03ab=[$015b]; then fills $03ac..$03bb (x=0x0f..0) with [$015a], rts.
export function loc_9234(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x015b); regs.setNZ(regs.a); m.step(0x9237, 4);
  mem.write8(0x03ab, regs.a); m.step(0x923a, 4);
  regs.a = mem.read8(0x015a); regs.setNZ(regs.a); m.step(0x923d, 4);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0x923f, 2);
  while (true) {
    mem.write8((0x03ac + regs.x) & 0xffff, regs.a); m.step(0x9242, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9243, 2);// 9242 dex
    if (regs.fN) { m.step(0x9245, 2); break; }
    m.step(0x923f, 3);
  }
  return m.ret(6);
}
