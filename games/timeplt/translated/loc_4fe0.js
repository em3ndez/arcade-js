// SPDX-License-Identifier: GPL-3.0-only

// loc_4fe0  (ROM 0x4FE0-0x5031)
export function loc_4fe0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x4fe3, 13); // 4fe0  ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x4fe4, 4); // 4fe3  and a

  let wide = false; // took the 0x502b arm
  if (regs.fZ) {
    m.step(0x502b, 12); // 4fe4  jr z,0x502b (taken) -- stage 0
    wide = true;
  } else {
    m.step(0x4fe6, 7); // 4fe4  jr z (not taken)
    regs.cp(0x04);
    m.step(0x4fe8, 7); // 4fe6  cp 0x04
    if (regs.fZ) {
      m.step(0x502b, 12); // 4fe8  jr z,0x502b (taken) -- stage 4
      wide = true;
    } else {
      m.step(0x4fea, 7); // 4fe8  jr z (not taken)
    }
  }

  if (wide) {
    regs.l = 0x08;
    m.step(0x502d, 7); // 502b  ld l,0x08
    regs.h = 0x11;
    m.step(0x502f, 7); // 502d  ld h,0x11
    m.step(0x4fee, 10); // 502f  jp 0x4fee -- back into the body
  } else {
    regs.l = 0x06;
    m.step(0x4fec, 7); // 4fea  ld l,0x06
    regs.h = 0x0d;
    m.step(0x4fee, 7); // 4fec  ld h,0x0d
  }

  regs.e = 0x17;
  m.step(0x4ff0, 7); // 4fee  ld e,0x17
  regs.d = 0x1f;
  m.step(0x4ff2, 7); // 4ff0  ld d,0x1f
  regs.iy = 0xaa80;
  m.step(0x4ff6, 14); // 4ff2  ld iy,0xaa80
  regs.b = 0x06;
  m.step(0x4ff8, 7); // 4ff6  ld b,0x06
  regs.a = mem.read8(0xa8a0);
  m.step(0x4ffb, 13); // 4ff8  ld a,(0xa8a0)
  regs.a = regs.inc8(regs.a);
  m.step(0x4ffc, 4); // 4ffb  inc a -- Z iff (0xa8a0) was 0xff

  if (regs.fNZ) {
    m.ret(11); // 4ffc  ret nz (taken)
    return;
  }
  m.step(0x4ffd, 5); // 4ffc  ret nz (not taken)

  for (;;) {
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
    m.step(0x5000, 19); // 4ffd  ld a,(iy+0x00)
    regs.a = regs.inc8(regs.a);
    m.step(0x5001, 4); // 5000  inc a

    if (regs.fNZ) {
      m.step(0x5022, 12); // 5001  jr nz,0x5022 -- record not free
    } else {
      m.step(0x5003, 7); // 5001  jr nz (not taken)
      regs.a = mem.read8(0xaa24);
      m.step(0x5006, 13); // 5003  ld a,(0xaa24)
      regs.sub(mem.read8((regs.iy + 0x06) & 0xffff));
      m.step(0x5009, 19); // 5006  sub (iy+0x06)
      regs.add(regs.l);
      m.step(0x500a, 4); // 5009  add a,l
      regs.cp(regs.h);
      m.step(0x500b, 4); // 500a  cp h

      if (regs.fNC) {
        m.step(0x5022, 12); // 500b  jr nc,0x5022 -- outside X
      } else {
        m.step(0x500d, 7); // 500b  jr nc (not taken)
        regs.a = mem.read8(0xaa55);
        m.step(0x5010, 13); // 500d  ld a,(0xaa55)
        regs.sub(mem.read8((regs.iy + 0x04) & 0xffff));
        m.step(0x5013, 19); // 5010  sub (iy+0x04)
        regs.add(regs.e);
        m.step(0x5014, 4); // 5013  add a,e
        regs.cp(regs.d);
        m.step(0x5015, 4); // 5014  cp d

        if (regs.fNC) {
          m.step(0x5022, 12); // 5015  jr nc,0x5022 -- outside Y
        } else {
          m.step(0x5017, 7); // 5015  jr nc (not taken) -- HIT
          regs.a = 0xf0;
          m.step(0x5019, 7); // 5017  ld a,0xf0
          mem.write8(0xa8a0, regs.a);
          m.step(0x501c, 13); // 5019  ld (0xa8a0),a
          mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
          m.step(0x501f, 19); // 501c  ld (iy+0x00),a

          m.push16(0x5022);
          m.step(0x51de, 17); // 501f  call 0x51de
          m.call(0x51de);
        }
      }
    }

    regs.a = regs.iy & 0xff;
    m.step(0x5024, 8); // 5022  ld a,iyl -- no flags
    regs.add(0x10);
    m.step(0x5026, 7); // 5024  add a,0x10
    regs.iy = (regs.iy & 0xff00) | regs.a;
    m.step(0x5028, 8); // 5026  ld iyl,a -- IYH untouched

    if (regs.djnz() !== 0) {
      m.step(0x4ffd, 13); // 5028  djnz 0x4ffd (taken)
      continue;
    }
    m.step(0x502a, 8); // 5028  djnz (not taken)
    break;
  }

  m.ret(); // 502a  ret
}
