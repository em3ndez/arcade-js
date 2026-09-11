// SPDX-License-Identifier: GPL-3.0-only
// loc_92b2  (ROM 0x92b2-0x92c4) -- swaps $03aa,x <-> $03bc,x for x=0x11..0 (via Y as temp), rts.
export function loc_92b2(m) {
  const { regs, mem } = m;
  regs.x = 0x11; regs.setNZ(regs.x); m.step(0x92b4, 2);
  while (true) {
    regs.a = mem.read8((0x03aa + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x92b7, 4);
    regs.y = mem.read8((0x03bc + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0x92ba, 4);
    mem.write8((0x03bc + regs.x) & 0xffff, regs.a); m.step(0x92bd, 5);
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0x92be, 2);
    mem.write8((0x03aa + regs.x) & 0xffff, regs.a); m.step(0x92c1, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x92c2, 2);
    if (regs.fN) { m.step(0x92c4, 2); break; }
    m.step(0x92b4, 3);
  }
  return m.ret(6);
}
