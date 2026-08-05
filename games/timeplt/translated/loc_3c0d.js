// SPDX-License-Identifier: GPL-3.0-only

// loc_3c0d  (ROM 0x3c0d-0x3c24, Time Pilot)
export function loc_3c0d(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x3c0e, 4); // 3c0d  xor a

  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x3c11, 19); // 3c0e  ld (ix+0x00),a
  mem.write8((regs.ix + 0x10) & 0xffff, regs.a);
  m.step(0x3c14, 19); // 3c11  ld (ix+0x10),a
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
  m.step(0x3c17, 19); // 3c14  ld (iy+0x00),a
  mem.write8((regs.iy + 0x31) & 0xffff, regs.a);
  m.step(0x3c1a, 19); // 3c17  ld (iy+0x31),a

  mem.write8(0xaa5b, regs.a);
  m.step(0x3c1d, 13); // 3c1a  ld (0xaa5b),a
  mem.write8(0xaa2a, regs.a);
  m.step(0x3c20, 13); // 3c1d  ld (0xaa2a),a

  mem.write8((regs.ix + 0x0e) & 0xffff, 0x80); // no flags
  m.step(0x3c24, 19); // 3c20  ld (ix+0x0e),0x80

  m.ret(); // 3c24  ret
}
