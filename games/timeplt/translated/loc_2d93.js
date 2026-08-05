// SPDX-License-Identifier: GPL-3.0-only

// loc_2d93  (ROM 0x2D93-0x2DB7, Time Pilot)
export function loc_2d93(m) {
  const { regs, mem } = m;

  regs.d = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x2d96, 19); // ld d,(iy+0x31)

  regs.e = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x2d99, 19); // ld e,(ix+0x03)

  regs.hl = mem.read16(0xa808);
  m.step(0x2d9c, 16); // ld hl,(0xa808)

  m.push16(0x2d9f);
  m.step(0x303e, 17); // call 0x303e
  m.call(0x303e);

  mem.write8((regs.iy + 0x31) & 0xffff, regs.h);
  m.step(0x2da2, 19); // ld (iy+0x31),h

  mem.write8((regs.ix + 0x03) & 0xffff, regs.l);
  m.step(0x2da5, 19); // ld (ix+0x03),l

  regs.d = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x2da8, 19); // ld d,(iy+0x00)

  regs.e = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2dab, 19); // ld e,(ix+0x05)

  regs.hl = mem.read16(0xa80a);
  m.step(0x2dae, 16); // ld hl,(0xa80a)

  m.push16(0x2db1);
  m.step(0x303e, 17); // call 0x303e
  m.call(0x303e);

  mem.write8((regs.iy + 0x00) & 0xffff, regs.h);
  m.step(0x2db4, 19); // ld (iy+0x00),h

  mem.write8((regs.ix + 0x05) & 0xffff, regs.l);
  m.step(0x2db7, 19); // ld (ix+0x05),l

  m.ret(); // 2db7  ret
}
