// SPDX-License-Identifier: GPL-3.0-only

// loc_4f7e  (ROM 0x4F7E-0x4FBE)
export function loc_4f7e(m) {
  const { regs, mem } = m;

  regs.l = 0x06;
  m.step(0x4f80, 7); // ld l,0x06
  regs.h = 0x0d;
  m.step(0x4f82, 7); // ld h,0x0d
  regs.e = 0x17;
  m.step(0x4f84, 7); // ld e,0x17
  regs.d = 0x1f;
  m.step(0x4f86, 7); // ld d,0x1f
  regs.iy = 0xaa80;
  m.step(0x4f8a, 14); // ld iy,0xaa80
  regs.b = 0x06;
  m.step(0x4f8c, 7); // ld b,0x06
  regs.a = mem.read8(0xa8c0);
  m.step(0x4f8f, 13); // ld a,(0xa8c0)
  regs.a = regs.inc8(regs.a);
  m.step(0x4f90, 4); // inc a -- Z iff (0xa8c0) was 0xFF
  if (regs.fNZ) {
    m.ret(11); // ret nz -- something is already marked
    return;
  }
  m.step(0x4f91, 5); // ret nz not taken

  for (;;) {
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
    m.step(0x4f94, 19); // ld a,(iy+0x00)
    regs.a = regs.inc8(regs.a);
    m.step(0x4f95, 4); // inc a
    if (regs.fNZ) {
      m.step(0x4fb6, 12); // jr nz,0x4fb6 -- record not free
    } else {
      m.step(0x4f97, 7); // jr nz not taken
      regs.a = mem.read8(0xaa28);
      m.step(0x4f9a, 13); // ld a,(0xaa28)
      regs.sub(mem.read8((regs.iy + 0x06) & 0xffff));
      m.step(0x4f9d, 19); // sub (iy+0x06)
      regs.add(regs.l);
      m.step(0x4f9e, 4); // add a,l
      regs.cp(regs.h);
      m.step(0x4f9f, 4); // cp h
      if (regs.fNC) {
        m.step(0x4fb6, 12); // jr nc,0x4fb6 -- outside X
      } else {
        m.step(0x4fa1, 7); // jr nc not taken
        regs.a = mem.read8(0xaa59);
        m.step(0x4fa4, 13); // ld a,(0xaa59)
        regs.sub(mem.read8((regs.iy + 0x04) & 0xffff));
        m.step(0x4fa7, 19); // sub (iy+0x04)
        regs.add(regs.e);
        m.step(0x4fa8, 4); // add a,e
        regs.cp(regs.d);
        m.step(0x4fa9, 4); // cp d
        if (regs.fNC) {
          m.step(0x4fb6, 12); // jr nc,0x4fb6 -- outside Y
        } else {
          m.step(0x4fab, 7); // jr nc not taken -- HIT
          regs.a = 0xf0;
          m.step(0x4fad, 7); // ld a,0xf0
          mem.write8(0xa8c0, regs.a);
          m.step(0x4fb0, 13); // ld (0xa8c0),a
          mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
          m.step(0x4fb3, 19); // ld (iy+0x00),a

          m.push16(0x4fb6);
          m.step(0x51de, 17); // call 0x51de
          m.call(0x51de);
        }
      }
    }

    regs.a = regs.iy & 0xff;
    m.step(0x4fb8, 8); // ld a,iyl -- flag-neutral
    regs.add(0x10);
    m.step(0x4fba, 7); // add a,0x10
    regs.iy = (regs.iy & 0xff00) | regs.a;
    m.step(0x4fbc, 8); // ld iyl,a -- IYH untouched
    if (regs.djnz() !== 0) {
      m.step(0x4f91, 13); // djnz taken -- next record
      continue;
    }
    m.step(0x4fbe, 8); // djnz not taken
    break;
  }

  m.ret(10); // 4fbe
}
