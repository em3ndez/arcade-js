// SPDX-License-Identifier: GPL-3.0-only
// loc_b85f (ROM 0xb85f-0xb874) -- seeds the paired 3-entry arrays $22-$24 (zp) and $0809-$080b:
// entry0=$00, entry1=$04, entry2=$0c. Straight-line, no branches; A=$00 at rts.
export function loc_b85f(m) {
  const { regs, mem } = m;
  regs.a = 0x0c; regs.setNZ(regs.a); m.step(0xb861, 2);
  mem.write8(0x080b, regs.a); m.step(0xb864, 4);
  mem.write8(0x24, regs.a); m.step(0xb866, 3);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xb868, 2);
  mem.write8(0x080a, regs.a); m.step(0xb86b, 4);
  mem.write8(0x23, regs.a); m.step(0xb86d, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb86f, 2);
  mem.write8(0x22, regs.a); m.step(0xb871, 3);
  mem.write8(0x0809, regs.a); m.step(0xb874, 4);
  return m.ret(6); // 0xb874 rts
}
