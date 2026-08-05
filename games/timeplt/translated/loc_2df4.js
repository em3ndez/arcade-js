// SPDX-License-Identifier: GPL-3.0-only

// loc_2df4  (ROM 0x2df4-0x2e18, Time Pilot)
export function loc_2df4(m) {
  const { regs, mem } = m;

  regs.d = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x2df7, 19); // 2df4  ld d,(iy+0x31)
  regs.e = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x2dfa, 19); // 2df7  ld e,(ix+0x03)

  regs.hl = mem.read16(0xa808);
  m.step(0x2dfd, 16); // 2dfa  ld hl,(0xa808)

  m.push16(0x2e00);
  m.step(0x304d, 17); // 2dfd  call 0x304d
  m.call(0x304d);

  mem.write8((regs.iy + 0x31) & 0xffff, regs.h);
  m.step(0x2e03, 19); // 2e00  ld (iy+0x31),h
  mem.write8((regs.ix + 0x03) & 0xffff, regs.l);
  m.step(0x2e06, 19); // 2e03  ld (ix+0x03),l

  regs.d = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x2e09, 19); // 2e06  ld d,(iy+0x00)
  regs.e = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2e0c, 19); // 2e09  ld e,(ix+0x05)

  regs.hl = mem.read16(0xa80a);
  m.step(0x2e0f, 16); // 2e0c  ld hl,(0xa80a)

  m.push16(0x2e12);
  m.step(0x304d, 17); // 2e0f  call 0x304d
  m.call(0x304d);

  mem.write8((regs.iy + 0x00) & 0xffff, regs.h);
  m.step(0x2e15, 19); // 2e12  ld (iy+0x00),h
  mem.write8((regs.ix + 0x05) & 0xffff, regs.l);
  m.step(0x2e18, 19); // 2e15  ld (ix+0x05),l

  m.ret(); // 2e18  ret
}
