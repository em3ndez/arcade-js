// SPDX-License-Identifier: GPL-3.0-only

// loc_3ce1  (ROM 0x3CE1–0x3CE8)
export function loc_3ce1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x3ce4, 19); // ld a,(iy+0x00)
  regs.add(0x02); // bias for the window test
  m.step(0x3ce6, 7); // add a,0x02
  regs.cp(0x04);
  m.step(0x3ce8, 7); // cp 0x04 -- C set iff (iy+0x00) is in -2..+1

  m.ret(); // 3ce8
}
