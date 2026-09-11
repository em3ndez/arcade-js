// SPDX-License-Identifier: GPL-3.0-only
// loc_926f  (ROM 0x926f-0x928e) -- zeros $02df..$02e5 (x=6..0), then zeros $0108,$0109,$0145,$0142,$0144,$0143,$0146, rts.
export function loc_926f(m) {
  const { regs, mem } = m;
  regs.x = 0x06; regs.setNZ(regs.x); m.step(0x9271, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9273, 2);
  while (true) {
    mem.write8((0x02df + regs.x) & 0xffff, regs.a); m.step(0x9276, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9277, 2);
    if (regs.fN) { m.step(0x9279, 2); break; }
    m.step(0x9273, 3);
  }
  mem.write8(0x0108, regs.a); m.step(0x927c, 4);
  mem.write8(0x0109, regs.a); m.step(0x927f, 4);
  mem.write8(0x0145, regs.a); m.step(0x9282, 4);
  mem.write8(0x0142, regs.a); m.step(0x9285, 4);
  mem.write8(0x0144, regs.a); m.step(0x9288, 4);
  mem.write8(0x0143, regs.a); m.step(0x928b, 4);
  mem.write8(0x0146, regs.a); m.step(0x928e, 4);
  return m.ret(6);
}
