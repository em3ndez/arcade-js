// SPDX-License-Identifier: GPL-3.0-only

// loc_3e05  (ROM 0x3E05–0x3E35)
export function loc_3e05(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.h = mem.read8(X(0x0b));
  m.step(0x3e08, 19); // ld h,(ix+0x0b)
  regs.l = mem.read8(X(0x0a));
  m.step(0x3e0b, 19); // ld l,(ix+0x0a)
  regs.de = mem.read16(0xa808);
  m.step(0x3e0f, 20); // ld de,(0xa808)
  regs.addHl(regs.de);
  m.step(0x3e10, 11); // add hl,de
  regs.d = mem.read8(Y(0x31));
  m.step(0x3e13, 19); // ld d,(iy+0x31)
  regs.e = mem.read8(X(0x03));
  m.step(0x3e16, 19); // ld e,(ix+0x03)
  regs.addHl(regs.de);
  m.step(0x3e17, 11); // add hl,de
  mem.write8(Y(0x31), regs.h);
  m.step(0x3e1a, 19); // ld (iy+0x31),h
  mem.write8(X(0x03), regs.l);
  m.step(0x3e1d, 19); // ld (ix+0x03),l

  regs.h = mem.read8(X(0x0d));
  m.step(0x3e20, 19); // ld h,(ix+0x0d)
  regs.l = mem.read8(X(0x0c));
  m.step(0x3e23, 19); // ld l,(ix+0x0c)
  regs.de = mem.read16(0xa80a);
  m.step(0x3e27, 20); // ld de,(0xa80a)
  regs.addHl(regs.de);
  m.step(0x3e28, 11); // add hl,de
  regs.d = mem.read8(Y(0x00));
  m.step(0x3e2b, 19); // ld d,(iy+0x00)
  regs.e = mem.read8(X(0x05));
  m.step(0x3e2e, 19); // ld e,(ix+0x05)
  regs.addHl(regs.de);
  m.step(0x3e2f, 11); // add hl,de
  mem.write8(Y(0x00), regs.h);
  m.step(0x3e32, 19); // ld (iy+0x00),h
  mem.write8(X(0x05), regs.l);
  m.step(0x3e35, 19); // ld (ix+0x05),l

  m.ret(10); // ret (0x3E35)
}
