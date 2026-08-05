// SPDX-License-Identifier: GPL-3.0-only

// loc_413c  (ROM 0x413C-0x4182, Time Pilot)
export function loc_413c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x413f, 19); // ld a,(ix+0x00)
  regs.cp(0x3c);
  m.step(0x4141, 7); // cp 0x3c -- carry iff count < 0x3C
  if (regs.fNC) {
    m.push16(0x4144);
    m.step(0x409d, 17); // call nc,0x409d taken
    m.call(0x409d);
  } else {
    m.step(0x4144, 10); // call nc NOT taken
  }

  m.push16(0x4147);
  m.step(0x2b60, 17); // call 0x2b60
  m.call(0x2b60);

  regs.decMem8(mem, (regs.ix + 0x00) & 0xffff);
  m.step(0x414a, 23); // dec (ix+0x00)
  if (regs.fZ) {
    m.step(0x40ab, 10); // jp z,0x40ab -- tail-jump to the retire path
    return m.call(0x40ab);
  }
  m.step(0x414d, 10); // jp z NOT taken

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x4150, 19); // ld a,(ix+0x00)
  regs.cp(0x1c);
  m.step(0x4152, 7); // cp 0x1c
  if (regs.fC) {
    m.ret(11); // ret c taken -- below the animation window
    return;
  }
  m.step(0x4153, 5); // ret c NOT taken

  regs.sub(0x1c);
  m.step(0x4155, 7); // sub 0x1c
  regs.rrca();
  m.step(0x4156, 4); // rrca
  regs.rrca();
  m.step(0x4157, 4); // rrca
  regs.and(0x07);
  m.step(0x4159, 7); // and 0x07 -- animation index 0..7
  regs.d = regs.a;
  m.step(0x415a, 4); // ld d,a
  regs.a = mem.read8(0xad04);
  m.step(0x415d, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x415f, 7); // cp 0x04

  if (regs.fNC) {
    m.step(0x4176, 12); // jr nc,0x4176 taken

    regs.hl = 0x4183;
    m.step(0x4179, 10); // ld hl,0x4183 -- the inline table below
    regs.a = regs.d;
    m.step(0x417a, 4); // ld a,d

    m.push16(0x417b);
    m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
    m.call(0x0008);

    mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
    m.step(0x417e, 19); // ld (iy+0x01),a
    mem.write8((regs.iy + 0x30) & 0xffff, 0x02);
    m.step(0x4182, 19); // ld (iy+0x30),0x02
    m.ret(10); // ret
    return;
  }
  m.step(0x4161, 7); // jr nc NOT taken

  regs.hl = 0x416e;
  m.step(0x4164, 10); // ld hl,0x416e -- the inline table below
  regs.a = regs.d;
  m.step(0x4165, 4); // ld a,d

  m.push16(0x4166);
  m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
  m.call(0x0008);

  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
  m.step(0x4169, 19); // ld (iy+0x01),a
  mem.write8((regs.iy + 0x30) & 0xffff, 0x0d);
  m.step(0x416d, 19); // ld (iy+0x30),0x0d
  m.ret(10); // ret
}
