// SPDX-License-Identifier: GPL-3.0-only

// loc_3b94  (ROM 0x3B94-0x3C08, Time Pilot)
export function loc_3b94(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.a = regs.dec8(regs.a);
  m.step(0x3b95, 4); // dec a -- back to the raw (ix+0x00)
  regs.c = regs.a;
  m.step(0x3b96, 4); // ld c,a
  regs.hl = 0xa8dc;
  m.step(0x3b99, 10); // ld hl,0xa8dc
  regs.a = mem.read8(regs.hl);
  m.step(0x3b9a, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x3b9b, 4); // and a

  if (regs.fNZ) {
    m.step(0x3b9e, 10); // jp z NOT taken

    regs.decMem8(mem, regs.hl);
    m.step(0x3b9f, 11); // dec (hl)
    mem.write8(IX(0x00), 0xff);
    m.step(0x3ba3, 19); // ld (ix+0x00),0xff

    m.push16(0x3ba6);
    m.step(0x5683, 17); // call 0x5683
    m.call(0x5683);

    m.step(0x3b77, 10); // jp 0x3b77 -- TAIL jump, nothing pushed
    return m.call(0x3b77);
  }
  m.step(0x3ba9, 10); // jp z,0x3ba9 taken

  regs.a = regs.c;
  m.step(0x3baa, 4); // ld a,c
  regs.cp(0x61);
  m.step(0x3bac, 7); // cp 0x61

  if (regs.fC) {
    m.step(0x3bbd, 12); // jr c,0x3bbd taken
  } else {
    m.step(0x3bae, 7); // jr c NOT taken

    mem.write8(IX(0x00), 0x61);
    m.step(0x3bb2, 19); // ld (ix+0x00),0x61

    m.push16(0x3bb5);
    m.step(0x5683, 17); // call 0x5683
    m.call(0x5683);

    mem.write8(IY(0x30), 0x3d);
    m.step(0x3bb9, 19); // ld (iy+0x30),0x3d
    mem.write8(IY(0x32), 0x3d);
    m.step(0x3bbd, 19); // ld (iy+0x32),0x3d
  }

  regs.decMem8(mem, IX(0x00));
  m.step(0x3bc0, 23); // dec (ix+0x00)

  if (regs.fZ) {
    m.step(0x3c0d, 12); // jr z,0x3c0d taken -- TAIL transfer, nothing pushed
    return m.call(0x3c0d);
  }
  m.step(0x3bc2, 7); // jr z NOT taken

  m.push16(0x3bc5);
  m.step(0x2b60, 17); // call 0x2b60
  m.call(0x2b60);

  regs.a = mem.read8(IY(0x31));
  m.step(0x3bc8, 19); // ld a,(iy+0x31)
  regs.add(0x10);
  m.step(0x3bca, 7); // add a,0x10
  mem.write8(IY(0x33), regs.a);
  m.step(0x3bcd, 19); // ld (iy+0x33),a
  regs.a = mem.read8(IY(0x00));
  m.step(0x3bd0, 19); // ld a,(iy+0x00)
  mem.write8(IY(0x02), regs.a);
  m.step(0x3bd3, 19); // ld (iy+0x02),a

  regs.a = mem.read8(IX(0x00));
  m.step(0x3bd6, 19); // ld a,(ix+0x00)
  regs.sub(0x40);
  m.step(0x3bd8, 7); // sub 0x40

  if (regs.fZ) {
    m.step(0x3bf1, 10); // jp z,0x3bf1 taken

    regs.de = 0x040b;
    m.step(0x3bf4, 10); // ld de,0x040b

    m.push16(0x3bf5);
    m.step(0x0038, 11); // rst 0x38 -- append (D,E) to the 0xAC00 ring
    m.call(0x0038);

    mem.write8(IY(0x03), 0xfa);
    m.step(0x3bf9, 19); // ld (iy+0x03),0xfa
    mem.write8(IY(0x01), 0xfb);
    m.step(0x3bfd, 19); // ld (iy+0x01),0xfb
    mem.write8(IY(0x30), 0x6c);
    m.step(0x3c01, 19); // ld (iy+0x30),0x6c
    mem.write8(IY(0x32), 0x6c);
    m.step(0x3c05, 19); // ld (iy+0x32),0x6c
    regs.decMem8(mem, IX(0x00));
    m.step(0x3c08, 23); // dec (ix+0x00)
    m.ret(); // 3c08  ret
    return;
  }
  m.step(0x3bdb, 10); // jp z NOT taken

  if (regs.fC) {
    m.ret(11); // 3bdb  ret c taken -- still below 0x40
    return;
  }
  m.step(0x3bdc, 5); // ret c NOT taken

  regs.c = regs.a;
  m.step(0x3bdd, 4); // ld c,a
  regs.and(0x07);
  m.step(0x3bdf, 7); // and 0x07

  if (regs.fNZ) {
    m.ret(11); // 3bdf  ret nz taken -- not on an 8-count boundary
    return;
  }
  m.step(0x3be0, 5); // ret nz NOT taken

  regs.a = regs.c;
  m.step(0x3be1, 4); // ld a,c
  regs.rrca();
  m.step(0x3be2, 4); // rrca
  regs.rrca();
  m.step(0x3be3, 4); // rrca
  regs.rrca();
  m.step(0x3be4, 4); // rrca -- the low 3 bits were zero, so this is a divide by 8
  regs.a = regs.dec8(regs.a);
  m.step(0x3be5, 4); // dec a
  regs.hl = 0x3c09;
  m.step(0x3be8, 10); // ld hl,0x3c09

  m.push16(0x3be9);
  m.step(0x0008, 11); // rst 0x08 -- A = (0x3c09 + A)
  m.call(0x0008);

  mem.write8(IY(0x03), regs.a);
  m.step(0x3bec, 19); // ld (iy+0x03),a
  regs.a = regs.inc8(regs.a);
  m.step(0x3bed, 4); // inc a
  mem.write8(IY(0x01), regs.a);
  m.step(0x3bf0, 19); // ld (iy+0x01),a
  m.ret(); // 3bf0  ret
}
