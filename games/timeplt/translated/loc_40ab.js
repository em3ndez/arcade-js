// SPDX-License-Identifier: GPL-3.0-only

// loc_40ab  (ROM 0x40AB-0x40B7, Time Pilot)
export function loc_40ab(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x00) & 0xffff, 0x00);
  m.step(0x40af, 19); // ld (ix+0x00),0x00
  mem.write8((regs.iy + 0x00) & 0xffff, 0x00);
  m.step(0x40b3, 19); // ld (iy+0x00),0x00
  mem.write8((regs.iy + 0x31) & 0xffff, 0x00);
  m.step(0x40b7, 19); // ld (iy+0x31),0x00
  m.ret(10); // ret
}
