// SPDX-License-Identifier: GPL-3.0-only

// loc_2b38  (ROM 0x2B38-0x2B51)
export function loc_2b38(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xa980);
  m.step(0x2b3b, 13); // ld a,(0xa980)
  regs.rrca();
  m.step(0x2b3c, 4); // rrca
  regs.rrca();
  m.step(0x2b3d, 4); // rrca
  regs.and(0x03);
  m.step(0x2b3f, 7); // and 0x03
  regs.add(0xd8);
  m.step(0x2b41, 7); // add a,0xd8
  regs.b = regs.a;
  m.step(0x2b42, 4); // ld b,a

  regs.a = mem.read8(IX(0x04));
  m.step(0x2b45, 19); // ld a,(ix+0x04)
  regs.sub(0x01);
  m.step(0x2b47, 7); // sub 0x01
  regs.add(regs.a);
  m.step(0x2b48, 4); // add a,a
  regs.add(regs.a);
  m.step(0x2b49, 4); // add a,a
  regs.add(regs.b);
  m.step(0x2b4a, 4); // add a,b

  mem.write8(IY(0x01), regs.a);
  m.step(0x2b4d, 19); // ld (iy+0x01),a
  mem.write8(IY(0x30), 0x61);
  m.step(0x2b51, 19); // ld (iy+0x30),0x61

  m.ret(); // 2b51  ret
}
