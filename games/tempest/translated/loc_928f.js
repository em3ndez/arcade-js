// SPDX-License-Identifier: GPL-3.0-only
// loc_928f  (ROM 0x928f-0x929e) -- zeros $02d3..$02de (x=0x0b..0), then $0135=0x00 and $a6=0x00, rts.
export function loc_928f(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9291, 2);
  regs.x = 0x0b; regs.setNZ(regs.x); m.step(0x9293, 2);
  while (true) {
    mem.write8((0x02d3 + regs.x) & 0xffff, regs.a); m.step(0x9296, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9297, 2);
    if (regs.fN) { m.step(0x9299, 2); break; }
    m.step(0x9293, 3);
  }
  mem.write8(0x0135, regs.a); m.step(0x929c, 4);
  mem.write8(0xa6, regs.a); m.step(0x929e, 3);
  return m.ret(6);
}
