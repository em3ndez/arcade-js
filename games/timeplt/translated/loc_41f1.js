// SPDX-License-Identifier: GPL-3.0-only

// loc_41f1  (ROM 0x41F1-0x4200, Time Pilot)
export function loc_41f1(m) {
  const { regs, mem } = m;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.a = mem.read8(0xa980);
  m.step(0x41f4, 13); // ld a,(0xa980)
  regs.rrca();
  m.step(0x41f5, 4); // rrca
  regs.and(0x07);
  m.step(0x41f7, 7); // and 0x07 -- an eight-step cycle
  regs.add(0x50);
  m.step(0x41f9, 7); // add a,0x50 -- the first tile code of the run
  mem.write8(Y(0x01), regs.a);
  m.step(0x41fc, 19); // ld (iy+0x01),a
  mem.write8(Y(0x30), 0x0a);
  m.step(0x4200, 19); // ld (iy+0x30),0x0a
  m.ret(10); // 4200  ret
}
