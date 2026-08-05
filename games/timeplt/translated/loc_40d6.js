// SPDX-License-Identifier: GPL-3.0-only

// loc_40d6  (ROM 0x40D6–0x4107)
export function loc_40d6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x40d9, 13); // ld a,(0xad04)
  regs.cp(0x02);
  m.step(0x40db, 7); // cp 0x02
  if (regs.fC) {
    m.ret(11); // ret c
    return;
  }
  m.step(0x40dc, 5); // ret c NOT taken

  regs.ix = 0xa8c0;
  m.step(0x40e0, 14); // ld ix,0xa8c0
  regs.iy = 0xaa28;
  m.step(0x40e4, 14); // ld iy,0xaa28
  regs.a = mem.read8(0xa8c6);
  m.step(0x40e7, 13); // ld a,(0xa8c6)
  regs.and(regs.a);
  m.step(0x40e8, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- no slots
    return;
  }
  m.step(0x40e9, 5); // ret z NOT taken

  regs.b = regs.a;
  m.step(0x40ea, 4); // ld b,a

  return m.call(0x40ea);
}
