// SPDX-License-Identifier: GPL-3.0-only

// loc_2d6e  (ROM 0x2D6E-0x2D92)
export function loc_2d6e(m) {
  const { regs, mem } = m;

  regs.d = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x2d71, 19); // ld d,(iy+0x31)
  regs.e = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x2d74, 19); // ld e,(ix+0x03)
  regs.hl = mem.read16(0xa808);
  m.step(0x2d77, 16); // ld hl,(0xa808)

  m.push16(0x2d7a);
  m.step(0x2e31, 17); // call 0x2e31
  m.call(0x2e31);

  mem.write8((regs.iy + 0x31) & 0xffff, regs.h);
  m.step(0x2d7d, 19); // ld (iy+0x31),h
  mem.write8((regs.ix + 0x03) & 0xffff, regs.l);
  m.step(0x2d80, 19); // ld (ix+0x03),l

  regs.d = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x2d83, 19); // ld d,(iy+0x00)
  regs.e = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2d86, 19); // ld e,(ix+0x05)
  regs.hl = mem.read16(0xa80a);
  m.step(0x2d89, 16); // ld hl,(0xa80a)

  m.push16(0x2d8c);
  m.step(0x2e31, 17); // call 0x2e31
  m.call(0x2e31);

  mem.write8((regs.iy + 0x00) & 0xffff, regs.h);
  m.step(0x2d8f, 19); // ld (iy+0x00),h
  mem.write8((regs.ix + 0x05) & 0xffff, regs.l);
  m.step(0x2d92, 19); // ld (ix+0x05),l
  m.ret(10); // 2d92
}
