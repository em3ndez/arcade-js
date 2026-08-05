// SPDX-License-Identifier: GPL-3.0-only

// loc_4ebc  (ROM 0x4EBC-0x4F29, Time Pilot)
export function loc_4ebc(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x4ebf, 13); // ld a,(0xa980)

  regs.and(0x01);
  m.step(0x4ec1, 7); // and 0x01

  if (regs.fNZ) {
    m.step(0x4f35, 10); // jp nz taken
    return m.call(0x4f35);
  }
  m.step(0x4ec4, 10); // jp nz not taken (jp cc costs 10 either way)

  m.push16(0x4ec7);
  m.step(0x4f7e, 17); // call 0x4f7e
  m.call(0x4f7e);

  regs.b = 0x04;
  m.step(0x4ec9, 7); // ld b,0x04
  regs.de = 0xa810;
  m.step(0x4ecc, 10); // ld de,0xa810
  regs.iy = 0xaa12;
  m.step(0x4ed0, 14); // ld iy,0xaa12
  regs.l = 0x05;
  m.step(0x4ed2, 7); // ld l,0x05
  regs.h = 0x0b;
  m.step(0x4ed4, 7); // ld h,0x0b

  m.push16(0x4ed7);
  m.step(0x5185, 17); // call 0x5185
  m.call(0x5185);

  regs.a = mem.read8(0xad0d);
  m.step(0x4eda, 13); // ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x4edb, 4); // and a

  if (regs.fNZ) {
    m.step(0x4f02, 12); // jr nz,0x4f02 taken

    regs.b = 0x05;
    m.step(0x4f04, 7); // ld b,0x05
    regs.l = 0x07;
    m.step(0x4f06, 7); // ld l,0x07
    regs.h = 0x0f;
    m.step(0x4f08, 7); // ld h,0x0f

    m.push16(0x4f0b);
    m.step(0x5152, 17); // call 0x5152
    m.call(0x5152);

    m.push16(0x4f0e);
    m.step(0x50b1, 17); // call 0x50b1 -- only this arm makes this call
    m.call(0x50b1);

    m.push16(0x4f11);
    m.step(0x507e, 17); // call 0x507e
    m.call(0x507e);

    regs.b = 0x01;
    m.step(0x4f13, 7); // ld b,0x01
    regs.de = 0xa8e0;
    m.step(0x4f16, 10); // ld de,0xa8e0
    regs.iy = 0xaa2c;
    m.step(0x4f1a, 14); // ld iy,0xaa2c
    regs.l = 0x05;
    m.step(0x4f1c, 7); // ld l,0x05
    regs.h = 0x0b;
    m.step(0x4f1e, 7); // ld h,0x0b

    m.push16(0x4f21);
    m.step(0x5185, 17); // call 0x5185
    m.call(0x5185);

    regs.b = 0x01;
    m.step(0x4f23, 7); // ld b,0x01
    regs.l = 0x08;
    m.step(0x4f25, 7); // ld l,0x08
    regs.h = 0x11;
    m.step(0x4f27, 7); // ld h,0x11

    m.step(0x51b3, 10); // jp 0x51b3 -- TAIL
    return m.call(0x51b3);
  }
  m.step(0x4edd, 7); // jr nz not taken

  regs.b = 0x07;
  m.step(0x4edf, 7); // ld b,0x07
  regs.l = 0x07;
  m.step(0x4ee1, 7); // ld l,0x07
  regs.h = 0x0f;
  m.step(0x4ee3, 7); // ld h,0x0f

  m.push16(0x4ee6);
  m.step(0x5152, 17); // call 0x5152
  m.call(0x5152);

  m.push16(0x4ee9);
  m.step(0x507e, 17); // call 0x507e
  m.call(0x507e);

  regs.b = 0x01;
  m.step(0x4eeb, 7); // ld b,0x01
  regs.de = 0xa8e0;
  m.step(0x4eee, 10); // ld de,0xa8e0
  regs.iy = 0xaa2c;
  m.step(0x4ef2, 14); // ld iy,0xaa2c
  regs.l = 0x05;
  m.step(0x4ef4, 7); // ld l,0x05
  regs.h = 0x0b;
  m.step(0x4ef6, 7); // ld h,0x0b

  m.push16(0x4ef9);
  m.step(0x5185, 17); // call 0x5185
  m.call(0x5185);

  regs.b = 0x01;
  m.step(0x4efb, 7); // ld b,0x01
  regs.l = 0x08;
  m.step(0x4efd, 7); // ld l,0x08
  regs.h = 0x11;
  m.step(0x4eff, 7); // ld h,0x11

  m.step(0x51b3, 10); // jp 0x51b3 -- TAIL
  return m.call(0x51b3);
}
