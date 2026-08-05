// SPDX-License-Identifier: GPL-3.0-only

// loc_3cd9  (ROM 0x3CD9-0x3CE8, Time Pilot)
export function loc_3cd9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x3cdc, 19); // ld a,(iy+0x31)

  regs.add(0x10);
  m.step(0x3cde, 7); // add a,0x10

  regs.cp(0x03);
  m.step(0x3ce0, 7); // cp 0x03

  if (regs.fC) {
    m.ret(11); // ret c taken -- in range
    return;
  }
  m.step(0x3ce1, 5); // ret c not taken

  return m.call(0x3ce1);
}
