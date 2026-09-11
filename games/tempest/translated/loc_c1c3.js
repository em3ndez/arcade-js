// SPDX-License-Identifier: GPL-3.0-only
// loc_c1c3  (ROM 0xc1c3-0xc1fc) -- zeroes zp $81/$91/$80/$78/$90/$88 and the $6080-$6090 hardware
// block (all but $608c), then writes $0f to $608c, and returns.
export function loc_c1c3(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(0x00); m.step(0xc1c5, 2);
  mem.write8(0x81, regs.a); m.step(0xc1c7, 3);
  mem.write8(0x91, regs.a); m.step(0xc1c9, 3);
  mem.write8(0x80, regs.a); m.step(0xc1cb, 3);
  mem.write8(0x78, regs.a); m.step(0xc1cd, 3);
  mem.write8(0x90, regs.a); m.step(0xc1cf, 3);
  mem.write8(0x88, regs.a); m.step(0xc1d1, 3);
  regs.a = 0x00; regs.setNZ(0x00); m.step(0xc1d3, 2);
  mem.write8(0x6080, regs.a); m.step(0xc1d6, 4);
  mem.write8(0x6081, regs.a); m.step(0xc1d9, 4);
  mem.write8(0x6084, regs.a); m.step(0xc1dc, 4);
  mem.write8(0x6085, regs.a); m.step(0xc1df, 4);
  mem.write8(0x6086, regs.a); m.step(0xc1e2, 4);
  mem.write8(0x6087, regs.a); m.step(0xc1e5, 4);
  mem.write8(0x6089, regs.a); m.step(0xc1e8, 4);
  mem.write8(0x6083, regs.a); m.step(0xc1eb, 4);
  mem.write8(0x608d, regs.a); m.step(0xc1ee, 4);
  mem.write8(0x608e, regs.a); m.step(0xc1f1, 4);
  mem.write8(0x608f, regs.a); m.step(0xc1f4, 4);
  mem.write8(0x6090, regs.a); m.step(0xc1f7, 4);
  regs.a = 0x0f; regs.setNZ(0x0f); m.step(0xc1f9, 2);
  mem.write8(0x608c, regs.a); m.step(0xc1fc, 4);
  return m.ret(6);
}
