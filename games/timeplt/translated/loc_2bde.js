// SPDX-License-Identifier: GPL-3.0-only

// loc_2bde  (ROM 0x2BDE-0x2BEE, Time Pilot)
export function loc_2bde(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x2bdf, 4); // xor a -- A = 0, carry cleared
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x2be2, 19); // ld (ix+0x00),a
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x2be5, 19); // ld (ix+0x03),a
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
  m.step(0x2be8, 19); // ld (ix+0x05),a
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
  m.step(0x2beb, 19); // ld (iy+0x00),a
  mem.write8((regs.iy + 0x31) & 0xffff, regs.a);
  m.step(0x2bee, 19); // ld (iy+0x31),a
  m.ret(10); // ret
}
