// SPDX-License-Identifier: GPL-3.0-only

// loc_3cc4  (ROM 0x3CC4–0x3CD8)
export function loc_3cc4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x3cc7, 19); // ld a,(ix+0x02)
  regs.add(0x40);
  m.step(0x3cc9, 7); // add a,0x40
  regs.bit(7, regs.a);
  m.step(0x3ccb, 8); // bit 7,a
  if (regs.fNZ) {
    m.step(0x3cd9, 10); // jp nz,0x3cd9 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x3cd9);
  }
  m.step(0x3cce, 10); // jp nz NOT taken

  regs.a = mem.read8((regs.iy + 0x31) & 0xffff);
  m.step(0x3cd1, 19); // ld a,(iy+0x31)
  regs.add(0x13);
  m.step(0x3cd3, 7); // add a,0x13
  regs.cp(0x03);
  m.step(0x3cd5, 7); // cp 0x03
  if (regs.fC) {
    m.ret(11); // ret c -- in range
    return;
  }
  m.step(0x3cd6, 5); // ret c NOT taken

  m.step(0x3ce1, 10); // jp 0x3ce1 -- TAIL jump, nothing pushed
  return m.call(0x3ce1);
}
