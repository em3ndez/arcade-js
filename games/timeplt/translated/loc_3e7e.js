// SPDX-License-Identifier: GPL-3.0-only

// loc_3e7e  (ROM 0x3E7E-0x3E8D)
export function loc_3e7e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x3e81, 13); // ld a,(0xa980)
  regs.rrca();
  m.step(0x3e82, 4); // rrca
  regs.and(0x07);
  m.step(0x3e84, 7); // and 0x07
  regs.add(0x40);
  m.step(0x3e86, 7); // add a,0x40
  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
  m.step(0x3e89, 19); // ld (iy+0x01),a
  mem.write8((regs.iy + 0x30) & 0xffff, 0x44);
  m.step(0x3e8d, 19); // ld (iy+0x30),0x44

  m.ret(10); // 3e8d
}
