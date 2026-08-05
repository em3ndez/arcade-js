// SPDX-License-Identifier: GPL-3.0-only

// loc_3ce9  (ROM 0x3CE9–0x3D24)
export function loc_3ce9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x3cec, 13); // ld a,(0xa980)
  regs.and(0x02);
  m.step(0x3cee, 7); // and 0x02
  regs.b = regs.a;
  m.step(0x3cef, 4); // ld b,a
  regs.a = mem.read8(0xa8dc);
  m.step(0x3cf2, 13); // ld a,(0xa8dc)
  regs.c = regs.a;
  m.step(0x3cf3, 4); // ld c,a
  regs.a = 0x03;
  m.step(0x3cf5, 7); // ld a,0x03
  regs.sub(regs.c);
  m.step(0x3cf6, 4); // sub c
  regs.add(regs.a);
  m.step(0x3cf7, 4); // add a,a
  regs.add(regs.a);
  m.step(0x3cf8, 4); // add a,a
  regs.add(0xa0);
  m.step(0x3cfa, 7); // add a,0xa0
  regs.add(regs.b);
  m.step(0x3cfb, 4); // add a,b
  regs.c = regs.a;
  m.step(0x3cfc, 4); // ld c,a
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x3cff, 19); // ld a,(ix+0x02)
  regs.add(0x40);
  m.step(0x3d01, 7); // add a,0x40
  regs.cp(0x80);
  m.step(0x3d03, 7); // cp 0x80

  if (regs.fC) {
    m.step(0x3d15, 12); // jr c,0x3d15 taken
    mem.write8((regs.iy + 0x03) & 0xffff, regs.c);
    m.step(0x3d18, 19); // ld (iy+0x03),c
    regs.c = regs.inc8(regs.c);
    m.step(0x3d19, 4); // inc c
    mem.write8((regs.iy + 0x01) & 0xffff, regs.c);
    m.step(0x3d1c, 19); // ld (iy+0x01),c
    mem.write8((regs.iy + 0x30) & 0xffff, 0x6d);
    m.step(0x3d20, 19); // ld (iy+0x30),0x6d
    mem.write8((regs.iy + 0x32) & 0xffff, 0x6d);
    m.step(0x3d24, 19); // ld (iy+0x32),0x6d
    m.ret(); // 0x3d24
    return;
  }

  m.step(0x3d05, 7); // jr c not taken
  mem.write8((regs.iy + 0x01) & 0xffff, regs.c);
  m.step(0x3d08, 19); // ld (iy+0x01),c
  regs.c = regs.inc8(regs.c);
  m.step(0x3d09, 4); // inc c
  mem.write8((regs.iy + 0x03) & 0xffff, regs.c);
  m.step(0x3d0c, 19); // ld (iy+0x03),c
  mem.write8((regs.iy + 0x30) & 0xffff, 0xed);
  m.step(0x3d10, 19); // ld (iy+0x30),0xed
  mem.write8((regs.iy + 0x32) & 0xffff, 0xed);
  m.step(0x3d14, 19); // ld (iy+0x32),0xed
  m.ret(); // 0x3d14
}
