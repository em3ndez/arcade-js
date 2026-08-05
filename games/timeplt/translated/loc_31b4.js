// SPDX-License-Identifier: GPL-3.0-only

// loc_31b4  (ROM 0x31B4-0x3214, Time Pilot)
export function loc_31b4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad05);
  m.step(0x31b7, 13); // ld a,(0xad05)

  regs.c = regs.a;
  m.step(0x31b8, 4); // ld c,a -- keep the whole byte

  regs.and(0xf0);
  m.step(0x31ba, 7); // and 0xf0

  if (regs.fZ) {
    m.step(0x31c9, 12); // jr z,0x31c9 taken -- high nibble 0
  } else {
    m.step(0x31bc, 7); // jr z not taken

    regs.cp(0x30);
    m.step(0x31be, 7); // cp 0x30

    if (regs.fNZ) {
      m.step(0x326c, 10);
      return m.call(0x326c);
    }
    m.step(0x31c1, 10); // jp nz not taken (jp costs 10 either way)

    regs.a = mem.read8(0x4903); // a ROM byte: always 0x30
    m.step(0x31c4, 13); // ld a,(0x4903)

    regs.cp(0x30);
    m.step(0x31c6, 7); // cp 0x30 -- always equal

    m.step(0x31c9, 10);
  }

  regs.a = regs.c;
  m.step(0x31ca, 4); // ld a,c

  regs.and(0x0f);
  m.step(0x31cc, 7); // and 0x0f -- A = slot index

  regs.cp(0x07);
  m.step(0x31ce, 7); // cp 0x07

  if (regs.fNC) {
    m.ret(11); // ret nc taken -- slot index out of range
    return;
  }
  m.step(0x31cf, 5); // ret nc not taken

  regs.ix = 0xa850;
  m.step(0x31d3, 14); // ld ix,0xa850

  regs.iy = 0xaa1a;
  m.step(0x31d7, 14); // ld iy,0xaa1a

  regs.add(regs.a);
  m.step(0x31d8, 4); // add a,a -- A = 2*slot

  regs.c = regs.a;
  m.step(0x31d9, 4); // ld c,a

  regs.b = 0x00;
  m.step(0x31db, 7); // ld b,0x00 -- BC = 2*slot

  regs.addIy(regs.bc);
  m.step(0x31dd, 15); // add iy,bc

  regs.add(regs.a);
  m.step(0x31de, 4); // add a,a

  regs.add(regs.a);
  m.step(0x31df, 4); // add a,a

  regs.add(regs.a);
  m.step(0x31e0, 4); // add a,a -- A = 16*slot

  regs.c = regs.a;
  m.step(0x31e1, 4); // ld c,a -- BC = 16*slot (B is still 0)

  regs.addIx(regs.bc);
  m.step(0x31e3, 15); // add ix,bc

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x31e6, 19); // ld a,(ix+0x00)

  regs.a = regs.inc8(regs.a);
  m.step(0x31e7, 4); // inc a -- Z only if the byte was 0xFF

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- slot not live
    return;
  }
  m.step(0x31e8, 5); // ret nz not taken

  m.push16(0x31eb);
  m.step(0x323a, 17); // call 0x323a
  m.call(0x323a);

  regs.a = mem.read8((regs.ix + 0x08) & 0xffff);
  m.step(0x31ee, 19); // ld a,(ix+0x08) -- the mode byte

  regs.cp(0x10);
  m.step(0x31f0, 7); // cp 0x10

  if (regs.fZ) {
    m.ret(11); // ret z taken -- mode 0x10, nothing to do
    return;
  }
  m.step(0x31f1, 5); // ret z not taken

  regs.cp(0x11);
  m.step(0x31f3, 7); // cp 0x11

  if (regs.fZ) {
    m.step(0x3201, 12); // jr z,0x3201 taken -- the mode-0x11 branch

    regs.hl = 0xac65;
    m.step(0x3204, 10); // ld hl,0xac65 -- unindexed

    m.push16(0x3207);
    m.step(0x33b8, 17); // call 0x33b8
    m.call(0x33b8);

    regs.add(0x80);
    m.step(0x3209, 7); // add a,0x80

    mem.write8((regs.ix + 0x01) & 0xffff, regs.a);
    m.step(0x320c, 19); // ld (ix+0x01),a

    mem.write8((regs.ix + 0x08) & 0xffff, 0x10);
    m.step(0x3210, 19); // ld (ix+0x08),0x10

    mem.write8((regs.ix + 0x09) & 0xffff, 0x00);
    m.step(0x3214, 19); // ld (ix+0x09),0x00

    m.ret(); // 3214  ret
    return;
  }
  m.step(0x31f5, 7); // jr z not taken

  regs.add(regs.a);
  m.step(0x31f6, 4); // add a,a -- 2*mode

  regs.hl = 0xac65;
  m.step(0x31f9, 10); // ld hl,0xac65

  m.push16(0x31fa);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  m.push16(0x31fd);
  m.step(0x33b8, 17); // call 0x33b8
  m.call(0x33b8);

  mem.write8((regs.ix + 0x01) & 0xffff, regs.a);
  m.step(0x3200, 19); // ld (ix+0x01),a

  m.ret(); // 3200  ret
}
