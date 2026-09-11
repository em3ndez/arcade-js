// SPDX-License-Identifier: GPL-3.0-only
// loc_a454  (ROM 0xa454-0xa461) -- for slots x=7..0, if $02d3,x!=0 call a463; rts.
export function loc_a454(m) {
  const { regs, mem } = m;
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xa456, 2);
  while (true) {
    regs.a = mem.read8((0x02d3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa459, 4);
    if (regs.fZ) { m.step(0xa45e, 3); }
    else {
      m.step(0xa45b, 2);
      m.push16(0xa45d); m.step(0xa45e, 6); m.call(0xa463);
    }
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xa45f, 2);
    if (!regs.fN) { m.step(0xa456, 3); continue; }
    m.step(0xa461, 2); break;
  }
  return m.ret(6);
}
