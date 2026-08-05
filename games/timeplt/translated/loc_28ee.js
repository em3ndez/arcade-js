// SPDX-License-Identifier: GPL-3.0-only

// loc_28ee  (ROM 0x28ee-0x28fd, Time Pilot)
export function loc_28ee(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad0d);
  m.step(0x28f1, 13); // 28ee  ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x28f2, 4); // 28f1  and a

  if (regs.fNZ) {
    m.ret(11); // ret nz taken
    return;
  }
  m.step(0x28f3, 5); // ret nz not taken

  regs.ix = 0xa8a0;
  m.step(0x28f7, 14); // 28f3  ld ix,0xa8a0
  regs.iy = 0xaa24;
  m.step(0x28fb, 14); // 28f7  ld iy,0xaa24

  m.step(0x290e, 10);
  return m.call(0x290e);
}
