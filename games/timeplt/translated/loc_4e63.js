// SPDX-License-Identifier: GPL-3.0-only

// loc_4e63  (ROM 0x4E63-0x4E96, plus the 0x4E97-0x4EBB arm)
export function loc_4e63(m) {
  const { regs, mem } = m;

  m.push16(0x4e66);
  m.step(0x4f5d, 17); // 4e63  call 0x4f5d
  m.call(0x4f5d);

  regs.b = 0x04;
  m.step(0x4e68, 7); // 4e66  ld b,0x04
  regs.de = 0xa810;
  m.step(0x4e6b, 10); // 4e68  ld de,0xa810
  regs.iy = 0xaa12;
  m.step(0x4e6f, 14); // 4e6b  ld iy,0xaa12
  regs.l = 0x05;
  m.step(0x4e71, 7); // 4e6f  ld l,0x05
  regs.h = 0x0b;
  m.step(0x4e73, 7); // 4e71  ld h,0x0b

  m.push16(0x4e76);
  m.step(0x5185, 17); // 4e73  call 0x5185
  m.call(0x5185);

  regs.a = mem.read8(0xad0d);
  m.step(0x4e79, 13); // 4e76  ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x4e7a, 4); // 4e79  and a

  if (regs.fNZ) {
    m.step(0x4e97, 12); // 4e7a  jr nz,0x4e97 (taken)

    regs.b = 0x05;
    m.step(0x4e99, 7); // 4e97  ld b,0x05
    regs.l = 0x07;
    m.step(0x4e9b, 7); // 4e99  ld l,0x07
    regs.h = 0x0f;
    m.step(0x4e9d, 7); // 4e9b  ld h,0x0f

    m.push16(0x4ea0);
    m.step(0x5152, 17); // 4e9d  call 0x5152
    m.call(0x5152);

    m.push16(0x4ea3);
    m.step(0x50b1, 17); // 4ea0  call 0x50b1
    m.call(0x50b1);

    regs.b = 0x03;
    m.step(0x4ea5, 7); // 4ea3  ld b,0x03
    regs.de = 0xa8c0;
    m.step(0x4ea8, 10); // 4ea5  ld de,0xa8c0
    regs.iy = 0xaa28;
    m.step(0x4eac, 14); // 4ea8  ld iy,0xaa28
    regs.l = 0x06;
    m.step(0x4eae, 7); // 4eac  ld l,0x06
    regs.h = 0x0d;
    m.step(0x4eb0, 7); // 4eae  ld h,0x0d

    m.push16(0x4eb3);
    m.step(0x5121, 17); // 4eb0  call 0x5121
    m.call(0x5121);

    regs.b = 0x01;
    m.step(0x4eb5, 7); // 4eb3  ld b,0x01
    regs.l = 0x08;
    m.step(0x4eb7, 7); // 4eb5  ld l,0x08
    regs.h = 0x11;
    m.step(0x4eb9, 7); // 4eb7  ld h,0x11

    m.step(0x51b3, 10); // 4eb9  jp 0x51b3 -- TAIL
    return m.call(0x51b3);
  }
  m.step(0x4e7c, 7); // 4e7a  jr nz (not taken)

  regs.b = 0x07;
  m.step(0x4e7e, 7); // 4e7c  ld b,0x07
  regs.l = 0x07;
  m.step(0x4e80, 7); // 4e7e  ld l,0x07
  regs.h = 0x0f;
  m.step(0x4e82, 7); // 4e80  ld h,0x0f

  m.push16(0x4e85);
  m.step(0x5152, 17); // 4e82  call 0x5152
  m.call(0x5152);

  regs.b = 0x03;
  m.step(0x4e87, 7); // 4e85  ld b,0x03
  regs.l = 0x06;
  m.step(0x4e89, 7); // 4e87  ld l,0x06
  regs.h = 0x0d;
  m.step(0x4e8b, 7); // 4e89  ld h,0x0d

  m.push16(0x4e8e);
  m.step(0x5121, 17); // 4e8b  call 0x5121
  m.call(0x5121);

  regs.b = 0x01;
  m.step(0x4e90, 7); // 4e8e  ld b,0x01
  regs.l = 0x08;
  m.step(0x4e92, 7); // 4e90  ld l,0x08
  regs.h = 0x11;
  m.step(0x4e94, 7); // 4e92  ld h,0x11

  m.step(0x51b3, 10); // 4e94  jp 0x51b3 -- TAIL
  return m.call(0x51b3);
}
