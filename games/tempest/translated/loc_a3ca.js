// SPDX-License-Identifier: GPL-3.0-only
// loc_a3ca  (ROM 0xa3ca-0xa3d3) -- saves A, calls ccc1, copies $02df,y->$29, restores A, then falls
// through into loc_a3d4.
export function loc_a3ca(m) {
  const { regs, mem } = m;
  m.push8(regs.a); m.step(0xa3cb, 3);
  m.push16(0xa3cd); m.step(0xa3ce, 6); m.call(0xccc1);
  regs.a = mem.read8((0x02df + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa3d1, 4);
  mem.write8(0x29, regs.a); m.step(0xa3d3, 3);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xa3d4, 4);
  return m.call(0xa3d4);
}
