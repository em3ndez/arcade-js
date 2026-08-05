// SPDX-License-Identifier: GPL-3.0-only

// loc_2b83  (ROM 0x2b83-0x2b92, Time Pilot)
export function loc_2b83(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x2b86, 19); // 2b83  ld a,(iy+0x31)
  regs.add(0x09);
  m.step(0x2b88, 7); // 2b86  add a,0x09
  regs.cp(0x03);
  m.step(0x2b8a, 7); // 2b88  cp 0x03

  if (regs.fC) {
    m.ret(11); // ret c taken
    return;
  }
  m.step(0x2b8b, 5); // ret c not taken

  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x2b8e, 19); // 2b8b  ld a,(iy+0x00)
  regs.sub(0x03);
  m.step(0x2b90, 7); // 2b8e  sub 0x03
  regs.cp(0x03);
  m.step(0x2b92, 7); // 2b90  cp 0x03 -- carry is the answer

  m.ret(); // 2b92  ret
}
