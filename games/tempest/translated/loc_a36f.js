// SPDX-License-Identifier: GPL-3.0-only
// loc_a36f  (ROM 0xa36f-0xa38d) -- calls ccc1, copies $02db,y->$29 and $02b5,y->$2d, calls a3d4 with A=0,
// clears $02db,y, decrements $a6, flags $02f2,x=0xff, rts.
export function loc_a36f(m) {
  const { regs, mem } = m;
  m.push16(0xa371); m.step(0xa372, 6); m.call(0xccc1);
  regs.a = mem.read8((0x02db + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa375, 4);
  mem.write8(0x29, regs.a); m.step(0xa377, 3);
  regs.a = mem.read8((0x02b5 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa37a, 4);
  mem.write8(0x2d, regs.a); m.step(0xa37c, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa37e, 2);
  m.push16(0xa380); m.step(0xa381, 6); m.call(0xa3d4);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa383, 2);
  mem.write8((0x02db + regs.y) & 0xffff, regs.a); m.step(0xa386, 5);
  { const v = (mem.read8(0xa6) - 1) & 0xff; mem.write8(0xa6, v); regs.setNZ(v); } m.step(0xa388, 5);
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa38a, 2);
  mem.write8((0x02f2 + regs.x) & 0xffff, regs.a); m.step(0xa38d, 5);
  return m.ret(6);
}
