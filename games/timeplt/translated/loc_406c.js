// SPDX-License-Identifier: GPL-3.0-only

// loc_406c  (ROM 0x406C-0x4093 and 0x40AB-0x40B7, Time Pilot)
export function loc_406c(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(X(0x00));
  m.step(0x406f, 19); // ld a,(ix+0x00)
  regs.cp(0x3c);
  m.step(0x4071, 7); // cp 0x3c
  if (regs.fNC) {
    m.push16(0x4074);
    m.step(0x409d, 17); // call nc,0x409d taken
    m.call(0x409d);
  } else {
    m.step(0x4074, 10); // call nc NOT taken
  }

  regs.decMem8(mem, X(0x00));
  m.step(0x4077, 23); // dec (ix+0x00)
  if (regs.fZ) {
    m.step(0x40ab, 12); // jr z,0x40ab taken -- the countdown expired

    mem.write8(X(0x00), 0x00);
    m.step(0x40af, 19); // ld (ix+0x00),0x00
    mem.write8(Y(0x00), 0x00);
    m.step(0x40b3, 19); // ld (iy+0x00),0x00
    mem.write8(Y(0x31), 0x00);
    m.step(0x40b7, 19); // ld (iy+0x31),0x00
    m.ret(10); // 40b7  ret
    return;
  }
  m.step(0x4079, 7); // jr z NOT taken

  m.push16(0x407c);
  m.step(0x2b60, 17); // call 0x2b60
  m.call(0x2b60);

  regs.a = mem.read8(X(0x00));
  m.step(0x407f, 19); // ld a,(ix+0x00)
  regs.cp(0x1c);
  m.step(0x4081, 7); // cp 0x1c
  if (regs.fC) {
    m.ret(11); // ret c taken -- (ix+0x00) < 0x1c
    return;
  }
  m.step(0x4082, 5); // ret c NOT taken

  regs.sub(0x1c);
  m.step(0x4084, 7); // sub 0x1c
  regs.rrca();
  m.step(0x4085, 4); // rrca
  regs.rrca();
  m.step(0x4086, 4); // rrca -- (A - 0x1C) / 4
  regs.and(0x0f);
  m.step(0x4088, 7); // and 0x0f
  regs.hl = 0x4094;
  m.step(0x408b, 10); // ld hl,0x4094 -- the 9-byte ROM table just below

  m.push16(0x408c);
  m.step(0x0008, 11); // rst 0x08 -- A = table[A]
  m.call(0x0008);

  mem.write8(Y(0x01), regs.a);
  m.step(0x408f, 19); // ld (iy+0x01),a
  mem.write8(Y(0x30), 0x0e);
  m.step(0x4093, 19); // ld (iy+0x30),0x0e
  m.ret(10); // 4093  ret
}
