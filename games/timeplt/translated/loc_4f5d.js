// SPDX-License-Identifier: GPL-3.0-only

// loc_4f5d  (ROM 0x4F5D–0x4F7D)
export function loc_4f5d(m) {
  const { regs, mem } = m;

  regs.de = 0xa8c0;
  m.step(0x4f60, 10); // ld de,0xa8c0
  regs.iy = 0xaa28;
  m.step(0x4f64, 14); // ld iy,0xaa28
  regs.ix = 0xaa80;
  m.step(0x4f68, 14); // ld ix,0xaa80

  regs.exAf(); // swap in the shadow AF -- A/flags parked
  m.step(0x4f69, 4); // ex af,af'
  regs.a = 0x03; // written into the SHADOW accumulator
  m.step(0x4f6b, 7); // ld a,0x03
  regs.b = regs.a; // B is not part of AF, so this is the main B
  m.step(0x4f6c, 4); // ld b,a
  regs.exAf(); // swap back; A' keeps the 3
  m.step(0x4f6d, 4); // ex af,af'

  regs.c = 0x06;
  m.step(0x4f6f, 7); // ld c,0x06
  mem.write16(0xa993, regs.de);
  m.step(0x4f73, 20); // ld (0xa993),de
  mem.write16(0xa991, regs.iy);
  m.step(0x4f77, 20); // ld (0xa991),iy
  regs.l = 0x07;
  m.step(0x4f79, 7); // ld l,0x07
  regs.h = 0x0f;
  m.step(0x4f7b, 7); // ld h,0x0f

  m.step(0x5211, 10);
  return m.call(0x5211);
}
