// SPDX-License-Identifier: GPL-3.0-only

// loc_4f35  (ROM 0x4F35-0x4F5C, Time Pilot)
export function loc_4f35(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad0d);
  m.step(0x4f38, 13); // ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x4f39, 4); // and a -- zero test

  if (regs.fNZ) {
    m.step(0x4fbf, 10); // jp nz,0x4fbf -- TAIL
    return m.call(0x4fbf);
  }
  m.step(0x4f3c, 10); // jp nz -- not taken

  regs.de = 0xa850;
  m.step(0x4f3f, 10); // ld de,0xa850
  regs.iy = 0xaa1a;
  m.step(0x4f43, 14); // ld iy,0xaa1a
  regs.ix = 0xaa80;
  m.step(0x4f47, 14); // ld ix,0xaa80

  regs.exAf();
  m.step(0x4f48, 4); // ex af,af'
  regs.a = 0x07;
  m.step(0x4f4a, 7); // ld a,0x07
  regs.b = regs.a;
  m.step(0x4f4b, 4); // ld b,a -- inner count
  regs.exAf();
  m.step(0x4f4c, 4); // ex af,af' -- leaves A' = 0x07 for 0x5211's reload

  regs.c = 0x06;
  m.step(0x4f4e, 7); // ld c,0x06 -- outer count

  mem.write16(0xa993, regs.de);
  m.step(0x4f52, 20); // ld (0xa993),de
  mem.write16(0xa991, regs.iy);
  m.step(0x4f56, 20); // ld (0xa991),iy

  regs.l = 0x07;
  m.step(0x4f58, 7); // ld l,0x07 -- half-width added before the bound test
  regs.h = 0x0f;
  m.step(0x4f5a, 7); // ld h,0x0f -- the bound

  m.step(0x5211, 10); // jp 0x5211 -- TAIL
  return m.call(0x5211);
}
