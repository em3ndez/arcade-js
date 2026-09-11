// SPDX-License-Identifier: GPL-3.0-only
// loc_a38e  (ROM 0xa38e-0xa397) -- flags $02f2,x=0xff, then y-=4, and falls through into the separately
// registered loc_a398 (which reads $0283,y / $02b9,y, stores $2d, calls a3ca/a06f, tail-jumps ca6c).
export function loc_a38e(m) {
  const { regs, mem } = m;
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa390, 2);
  mem.write8((0x02f2 + regs.x) & 0xffff, regs.a); m.step(0xa393, 5);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xa394, 2);
  regs.sec(); m.step(0xa395, 2);
  regs.sbc(0x04); m.step(0xa397, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa398, 2);// a397 tay -> fall through
  return m.call(0xa398);
}
