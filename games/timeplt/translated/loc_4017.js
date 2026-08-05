// SPDX-License-Identifier: GPL-3.0-only

// loc_4017  (ROM 0x4017–0x406B)
export function loc_4017(m) {
  const { regs, mem } = m;

  regs.d = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x401a, 19); // ld d,(iy+0x31)
  regs.e = mem.read8((regs.ix + 0x03) & 0xffff);
  m.step(0x401d, 19); // ld e,(ix+0x03) -- DE = the 16-bit X
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x4020, 19); // ld a,(ix+0x01) -- the direction flag
  regs.and(regs.a);
  m.step(0x4021, 4); // and a

  if (regs.fZ) {
    m.step(0x4028, 12); // jr z,0x4028 taken
    regs.hl = 0x0180;
    m.step(0x402b, 10); // ld hl,0x0180
  } else {
    m.step(0x4023, 7); // jr z not taken
    regs.hl = 0xfe80;
    m.step(0x4026, 10); // ld hl,0xfe80 -- -0x0180
    m.step(0x402b, 12); // jr 0x402b
  }

  regs.addHl(regs.de);
  m.step(0x402c, 11); // add hl,de -- X + the drift
  regs.de = mem.read16(0xa808);
  m.step(0x4030, 20); // ld de,(0xa808) -- the X scroll delta
  regs.addHl(regs.de);
  m.step(0x4031, 11); // add hl,de
  mem.write8((regs.iy + 0x31) & 0xffff, regs.h);
  m.step(0x4034, 19); // ld (iy+0x31),h
  mem.write8((regs.ix + 0x03) & 0xffff, regs.l);
  m.step(0x4037, 19); // ld (ix+0x03),l

  regs.l = mem.read8((regs.ix + 0x07) & 0xffff);
  m.step(0x403a, 19); // ld l,(ix+0x07)
  regs.h = mem.read8((regs.ix + 0x08) & 0xffff);
  m.step(0x403d, 19); // ld h,(ix+0x08) -- HL = the 16-bit Y velocity
  regs.de = 0x0009;
  m.step(0x4040, 10); // ld de,0x0009
  regs.addHl(regs.de);
  m.step(0x4041, 11); // add hl,de -- gravity
  mem.write8((regs.ix + 0x07) & 0xffff, regs.l);
  m.step(0x4044, 19); // ld (ix+0x07),l
  mem.write8((regs.ix + 0x08) & 0xffff, regs.h);
  m.step(0x4047, 19); // ld (ix+0x08),h -- HL is unchanged by the stores

  regs.d = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x404a, 19); // ld d,(iy+0x00)
  regs.e = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x404d, 19); // ld e,(ix+0x05) -- DE = the 16-bit Y
  regs.addHl(regs.de);
  m.step(0x404e, 11); // add hl,de -- Y + the new velocity
  regs.de = mem.read16(0xa80a);
  m.step(0x4052, 20); // ld de,(0xa80a) -- the Y scroll delta
  regs.addHl(regs.de);
  m.step(0x4053, 11); // add hl,de
  mem.write8((regs.iy + 0x00) & 0xffff, regs.h);
  m.step(0x4056, 19); // ld (iy+0x00),h
  mem.write8((regs.ix + 0x05) & 0xffff, regs.l);
  m.step(0x4059, 19); // ld (ix+0x05),l

  regs.a = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x405c, 19); // ld a,(iy+0x31)
  regs.add(0x10); // bias for the range test
  m.step(0x405e, 7); // add a,0x10
  regs.cp(0x20);
  m.step(0x4060, 7); // cp 0x20
  if (regs.fC) {
    m.step(0x40ab, 10); // jp c,0x40ab taken -- off the side, TAIL
    return m.call(0x40ab);
  }
  m.step(0x4063, 10); // jp c not taken

  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x4066, 19); // ld a,(iy+0x00)
  regs.cp(0xf8);
  m.step(0x4068, 7); // cp 0xf8
  if (!regs.fC) {
    m.step(0x40ab, 10); // jp nc,0x40ab taken -- off the bottom, TAIL
    return m.call(0x40ab);
  }
  m.step(0x406b, 10); // jp nc not taken

  m.ret(); // 406b
}
