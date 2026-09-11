// SPDX-License-Identifier: GPL-3.0-only
// loc_b332  (ROM 0xb332-0xb366) -- if $cec4 != $2000: store it, rts with C set. Else write a word from
// $ce9e[x] via ($74), clear $016e, advance $74/$75 from $ce68[x] (x=8 if $0415!=0 else 2), rts C clear.
export function loc_b332(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0xcec4); regs.setNZ(regs.a); m.step(0xb335, 4);
  regs.cmp(mem.read8(0x2000)); m.step(0xb338, 4);
  if (regs.fZ) {
    m.step(0xb33f, 3);
  } else {
    m.step(0xb33a, 2);
    mem.write8(0x2000, regs.a); m.step(0xb33d, 4);
    regs.sec(); m.step(0xb33e, 2);
    return m.ret(6);
  }
  regs.a = mem.read8(0x0415); regs.setNZ(regs.a); m.step(0xb342, 4);
  if (regs.fNZ) {
    m.step(0xb349, 3);
    regs.x = 0x08; regs.setNZ(regs.x); m.step(0xb34b, 2);
  } else {
    m.step(0xb344, 2);
    regs.x = 0x02; regs.setNZ(regs.x); m.step(0xb346, 2);
    regs.clv(); m.step(0xb347, 2);
    m.step(0xb34b, 3);
  }
  { const ea = (0xce9e + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb34e, (0xce9e & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb350, 2);
  mem.write8(0x016e, regs.y); m.step(0xb353, 4);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xb355, 6);
  regs.y = regs.inc8(regs.y); m.step(0xb356, 2);
  { const ea = (0xce9f + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb359, (0xce9f & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xb35b, 6);
  { const ea = (0xce68 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb35e, (0xce68 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  mem.write8(0x74, regs.a); m.step(0xb360, 3);
  { const ea = (0xce69 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb363, (0xce69 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  mem.write8(0x75, regs.a); m.step(0xb365, 3);
  regs.clc(); m.step(0xb366, 2);
  return m.ret(6);
}
