// SPDX-License-Identifier: GPL-3.0-only

// loc_3b5f  (ROM 0x3b5f-0x3b93, Time Pilot)
export function loc_3b5f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x3b62, 13); // 3b5f  ld a,(0xad04)
  regs.a = regs.dec8(regs.a);
  m.step(0x3b63, 4); // 3b62  dec a -- Z iff (0xad04) was 1

  if (regs.fNZ) {
    m.ret(11); // ret nz taken
    return;
  }
  m.step(0x3b64, 5); // ret nz not taken

  regs.ix = 0xa8c0;
  m.step(0x3b68, 14); // 3b64  ld ix,0xa8c0
  regs.iy = 0xaa28;
  m.step(0x3b6c, 14); // 3b68  ld iy,0xaa28

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3b6f, 19); // 3b6c  ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x3b70, 4); // 3b6f  and a

  if (regs.fZ) {
    m.step(0x3c25, 10); // jp z taken
    return m.call(0x3c25);
  }
  m.step(0x3b73, 10); // jp z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x3b74, 4); // 3b73  inc a -- Z iff (ix+0x00) was 0xff

  if (regs.fNZ) {
    m.step(0x3b94, 10); // jp nz taken
    return m.call(0x3b94);
  }
  m.step(0x3b77, 10); // jp nz not taken -> fall through into loc_3b77

  return m.call(0x3b77);
}
