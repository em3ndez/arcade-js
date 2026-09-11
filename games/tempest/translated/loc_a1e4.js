// SPDX-License-Identifier: GPL-3.0-only
// loc_a1e4  (ROM 0xa1e4-0xa1f9) -- if $0200 == $02ad,x and $0201 is non-negative, jsr a34b and set
// $0201 = 0x81; otherwise return unchanged.
export function loc_a1e4(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0xa1e7, 4);
  regs.cmp(mem.read8((0x02ad + regs.x) & 0xffff)); m.step(0xa1ea, 4);
  if (regs.fNZ) { m.step(0xa1f9, 3); return m.ret(6); }
  m.step(0xa1ec, 2);
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xa1ef, 4);
  if (regs.fN) { m.step(0xa1f9, 3); return m.ret(6); }
  m.step(0xa1f1, 2);
  m.push16(0xa1f3); m.step(0xa1f4, 6); m.call(0xa34b);
  regs.a = 0x81; regs.setNZ(regs.a); m.step(0xa1f6, 2);
  mem.write8(0x0201, regs.a); m.step(0xa1f9, 4);
  return m.ret(6);
}
