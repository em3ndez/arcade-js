// SPDX-License-Identifier: GPL-3.0-only

// loc_2b60  (ROM 0x2B60–0x2B82)
export function loc_2b60(m) {
  const { regs, mem } = m;

  regs.h = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x2b63, 19); // ld h,(iy+0x31)
  regs.l = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x2b66, 19); // ld l,(ix+0x03)
  regs.de = mem.read16(0xa808);
  m.step(0x2b6a, 20); // ld de,(0xa808)
  regs.addHl(regs.de);
  m.step(0x2b6b, 11); // add hl,de
  mem.write8((regs.iy + 0x31) & 0xffff, regs.h);
  m.step(0x2b6e, 19); // ld (iy+0x31),h
  mem.write8((regs.ix + 0x03) & 0xffff, regs.l);
  m.step(0x2b71, 19); // ld (ix+0x03),l

  regs.h = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x2b74, 19); // ld h,(iy+0x00)
  regs.l = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2b77, 19); // ld l,(ix+0x05)
  regs.de = mem.read16(0xa80a);
  m.step(0x2b7b, 20); // ld de,(0xa80a)
  regs.addHl(regs.de);
  m.step(0x2b7c, 11); // add hl,de
  mem.write8((regs.iy + 0x00) & 0xffff, regs.h);
  m.step(0x2b7f, 19); // ld (iy+0x00),h
  mem.write8((regs.ix + 0x05) & 0xffff, regs.l);
  m.step(0x2b82, 19); // ld (ix+0x05),l

  m.ret(); // 0x2b82
}
