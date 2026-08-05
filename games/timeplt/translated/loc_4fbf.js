// SPDX-License-Identifier: GPL-3.0-only

// loc_4fbf  (ROM 0x4FBF-0x5031)
export function loc_4fbf(m) {
  const { regs, mem } = m;

  regs.de = 0xa850;
  m.step(0x4fc2, 10); // ld de,0xa850
  regs.iy = 0xaa1a;
  m.step(0x4fc6, 14); // ld iy,0xaa1a
  regs.ix = 0xaa80;
  m.step(0x4fca, 14); // ld ix,0xaa80
  regs.exAf();
  m.step(0x4fcb, 4); // ex af,af'
  regs.a = 0x05;
  m.step(0x4fcd, 7); // ld a,0x05
  regs.b = regs.a;
  m.step(0x4fce, 4); // ld b,a
  regs.exAf();
  m.step(0x4fcf, 4); // ex af,af' -- the live A is back, A' = 0x05
  regs.c = 0x06;
  m.step(0x4fd1, 7); // ld c,0x06
  mem.write16(0xa993, regs.de);
  m.step(0x4fd5, 20); // ld (0xa993),de
  mem.write16(0xa991, regs.iy);
  m.step(0x4fd9, 20); // ld (0xa991),iy
  regs.l = 0x07;
  m.step(0x4fdb, 7); // ld l,0x07
  regs.h = 0x0f;
  m.step(0x4fdd, 7); // ld h,0x0f

  m.push16(0x4fe0);
  m.step(0x5211, 17); // call 0x5211
  m.call(0x5211);

  regs.a = mem.read8(0xad04);
  m.step(0x4fe3, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x4fe4, 4); // and a

  let wide = false; // took the 0x502B arm
  if (regs.fZ) {
    m.step(0x502b, 12); // jr z,0x502b taken -- stage 0
    wide = true;
  } else {
    m.step(0x4fe6, 7); // jr z not taken
    regs.cp(0x04);
    m.step(0x4fe8, 7); // cp 0x04
    if (regs.fZ) {
      m.step(0x502b, 12); // jr z,0x502b taken -- stage 4
      wide = true;
    } else {
      m.step(0x4fea, 7); // jr z not taken
    }
  }

  if (wide) {
    regs.l = 0x08;
    m.step(0x502d, 7); // ld l,0x08
    regs.h = 0x11;
    m.step(0x502f, 7); // ld h,0x11
    m.step(0x4fee, 10); // jp 0x4fee -- back into the body
  } else {
    regs.l = 0x06;
    m.step(0x4fec, 7); // ld l,0x06
    regs.h = 0x0d;
    m.step(0x4fee, 7); // ld h,0x0d
  }

  regs.e = 0x17;
  m.step(0x4ff0, 7); // ld e,0x17
  regs.d = 0x1f;
  m.step(0x4ff2, 7); // ld d,0x1f
  regs.iy = 0xaa80;
  m.step(0x4ff6, 14); // ld iy,0xaa80
  regs.b = 0x06;
  m.step(0x4ff8, 7); // ld b,0x06
  regs.a = mem.read8(0xa8a0);
  m.step(0x4ffb, 13); // ld a,(0xa8a0)
  regs.a = regs.inc8(regs.a);
  m.step(0x4ffc, 4); // inc a -- Z iff (0xa8a0) was 0xFF
  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x4ffd, 5); // ret nz not taken

  for (;;) {
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
    m.step(0x5000, 19); // ld a,(iy+0x00)
    regs.a = regs.inc8(regs.a);
    m.step(0x5001, 4); // inc a
    if (regs.fNZ) {
      m.step(0x5022, 12); // jr nz,0x5022 -- record not free
    } else {
      m.step(0x5003, 7); // jr nz not taken
      regs.a = mem.read8(0xaa24);
      m.step(0x5006, 13); // ld a,(0xaa24)
      regs.sub(mem.read8((regs.iy + 0x06) & 0xffff));
      m.step(0x5009, 19); // sub (iy+0x06)
      regs.add(regs.l);
      m.step(0x500a, 4); // add a,l
      regs.cp(regs.h);
      m.step(0x500b, 4); // cp h
      if (regs.fNC) {
        m.step(0x5022, 12); // jr nc,0x5022 -- outside X
      } else {
        m.step(0x500d, 7); // jr nc not taken
        regs.a = mem.read8(0xaa55);
        m.step(0x5010, 13); // ld a,(0xaa55)
        regs.sub(mem.read8((regs.iy + 0x04) & 0xffff));
        m.step(0x5013, 19); // sub (iy+0x04)
        regs.add(regs.e);
        m.step(0x5014, 4); // add a,e
        regs.cp(regs.d);
        m.step(0x5015, 4); // cp d
        if (regs.fNC) {
          m.step(0x5022, 12); // jr nc,0x5022 -- outside Y
        } else {
          m.step(0x5017, 7); // jr nc not taken -- HIT
          regs.a = 0xf0;
          m.step(0x5019, 7); // ld a,0xf0
          mem.write8(0xa8a0, regs.a);
          m.step(0x501c, 13); // ld (0xa8a0),a
          mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
          m.step(0x501f, 19); // ld (iy+0x00),a

          m.push16(0x5022);
          m.step(0x51de, 17); // call 0x51de
          m.call(0x51de);
        }
      }
    }

    regs.a = regs.iy & 0xff;
    m.step(0x5024, 8); // ld a,iyl -- flag-neutral
    regs.add(0x10);
    m.step(0x5026, 7); // add a,0x10
    regs.iy = (regs.iy & 0xff00) | regs.a;
    m.step(0x5028, 8); // ld iyl,a -- IYH untouched
    if (regs.djnz() !== 0) {
      m.step(0x4ffd, 13); // djnz taken -- next record
      continue;
    }
    m.step(0x502a, 8); // djnz not taken
    break;
  }

  m.ret(10); // 502a
}
