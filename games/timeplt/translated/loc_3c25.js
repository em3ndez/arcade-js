// SPDX-License-Identifier: GPL-3.0-only

// loc_3c25  (ROM 0x3C25-0x3C83)
export function loc_3c25(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x3c28, 13); // ld a,(0xa980)
  regs.and(0x01);
  m.step(0x3c2a, 7); // and 0x01
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- odd frame
    return;
  }
  m.step(0x3c2b, 5); // ret nz not taken

  regs.decMem8(mem, (regs.ix + 0x0e) & 0xffff);
  m.step(0x3c2e, 23); // dec (ix+0x0e)
  if (regs.fZ) {
    m.step(0x3c32, 10); // jp z,0x3c32 taken
  } else {
    m.step(0x3c31, 10); // jp z not taken
    m.ret(10); // 3c31 -- timer still running
    return;
  }

  regs.a = mem.read8(0xad0d);
  m.step(0x3c35, 13); // ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x3c36, 4); // and a -- zero test
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- gated off
    return;
  }
  m.step(0x3c37, 5); // ret nz not taken

  regs.a = mem.read8(0xa802);
  m.step(0x3c3a, 13); // ld a,(0xa802)
  regs.b = regs.a;
  m.step(0x3c3b, 4); // ld b,a -- B keeps the raw heading
  regs.add(0x08);
  m.step(0x3c3d, 7); // add a,0x08
  regs.and(0x7f);
  m.step(0x3c3f, 7); // and 0x7f
  regs.cp(0x10);
  m.step(0x3c41, 7); // cp 0x10

  if (regs.fC) {
    m.step(0x3c75, 12); // jr c,0x3c75 taken

    regs.a = mem.read8(0xa980);
    m.step(0x3c78, 13); // ld a,(0xa980)
    regs.c = regs.a;
    m.step(0x3c79, 4); // ld c,a
    regs.a = 0x10;
    m.step(0x3c7b, 7); // ld a,0x10
    regs.bit(3, regs.c);
    m.step(0x3c7d, 8); // bit 3,c
    if (regs.fNZ) {
      m.step(0x3c81, 12); // jr nz,0x3c81 taken -- keep +0x10
    } else {
      m.step(0x3c7f, 7); // jr nz not taken
      regs.neg();
      m.step(0x3c81, 8); // neg -- A = -0x10
    }
    regs.add(regs.b);
    m.step(0x3c82, 4); // add a,b
    m.step(0x3c44, 12); // jr 0x3c44
  } else {
    m.step(0x3c43, 7); // jr c not taken
    regs.a = regs.b;
    m.step(0x3c44, 4); // ld a,b
  }

  regs.rrca();
  m.step(0x3c45, 4); // rrca
  regs.rrca();
  m.step(0x3c46, 4); // rrca
  regs.and(0x3e);
  m.step(0x3c48, 7); // and 0x3e -- even offset into the 0x3C84 table
  regs.hl = 0x3c84;
  m.step(0x3c4b, 10); // ld hl,0x3c84

  m.push16(0x3c4c);
  m.step(0x0008, 11); // rst 0x08 -- A = (HL + A), HL = HL + A
  m.call(0x0008);

  mem.write8((regs.iy + 0x31) & 0xffff, regs.a);
  m.step(0x3c4f, 19); // ld (iy+0x31),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x3c50, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x3c51, 7); // ld a,(hl) -- the pair's second byte
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
  m.step(0x3c54, 19); // ld (iy+0x00),a

  regs.a = regs.b;
  m.step(0x3c55, 4); // ld a,b
  regs.add(0xc0);
  m.step(0x3c57, 7); // add a,0xc0
  regs.and(0x80);
  m.step(0x3c59, 7); // and 0x80
  mem.write8((regs.ix + 0x02) & 0xffff, regs.a);
  m.step(0x3c5c, 19); // ld (ix+0x02),a

  m.push16(0x3c5f);
  m.step(0x5942, 17); // call 0x5942
  m.call(0x5942);

  mem.write8((regs.ix + 0x0a) & 0xffff, regs.e);
  m.step(0x3c62, 19); // ld (ix+0x0a),e
  mem.write8((regs.ix + 0x0b) & 0xffff, regs.d);
  m.step(0x3c65, 19); // ld (ix+0x0b),d
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.c);
  m.step(0x3c68, 19); // ld (ix+0x0c),c
  mem.write8((regs.ix + 0x0d) & 0xffff, regs.b);
  m.step(0x3c6b, 19); // ld (ix+0x0d),b

  regs.a = 0x03;
  m.step(0x3c6d, 7); // ld a,0x03
  mem.write8(0xa8dc, regs.a);
  m.step(0x3c70, 13); // ld (0xa8dc),a
  mem.write8((regs.ix + 0x00) & 0xffff, 0xff);
  m.step(0x3c74, 19); // ld (ix+0x00),0xff -- slot live

  m.ret(10); // 3c74
}
