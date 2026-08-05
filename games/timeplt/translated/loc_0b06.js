// SPDX-License-Identifier: GPL-3.0-only

// loc_0b06  (ROM 0x0B06–0x0B2A)
export function loc_0b06(m) {
  const { regs, mem } = m;

  regs.iy = 0xaa10;
  m.step(0x0b0a, 14); // ld iy,0xaa10
  regs.b = 0x04;
  m.step(0x0b0c, 7); // ld b,0x04
  regs.c = 0x04;
  m.step(0x0b0e, 7); // ld c,0x04
  regs.d = 0xa0;
  m.step(0x0b10, 7); // ld d,0xa0
  regs.e = 0xd8;
  m.step(0x0b12, 7); // ld e,0xd8

  do {
    mem.write8((regs.iy + 0x31) & 0xffff, regs.d);
    m.step(0x0b15, 19); // ld (iy+0x31),d
    mem.write8((regs.iy + 0x00) & 0xffff, regs.e);
    m.step(0x0b18, 19); // ld (iy+0x00),e
    mem.write8((regs.iy + 0x01) & 0xffff, regs.c);
    m.step(0x0b1b, 19); // ld (iy+0x01),c
    mem.write8((regs.iy + 0x30) & 0xffff, 0x6c);
    m.step(0x0b1f, 19); // ld (iy+0x30),0x6c
    regs.iy = (regs.iy + 1) & 0xffff; // 16-bit INC: no flags
    m.step(0x0b21, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x0b23, 10); // inc iy
    regs.c = regs.inc8(regs.c);
    m.step(0x0b24, 4); // inc c
    regs.a = regs.d;
    m.step(0x0b25, 4); // ld a,d
    regs.sub(0x10);
    m.step(0x0b27, 7); // sub 0x10
    regs.d = regs.a;
    m.step(0x0b28, 4); // ld d,a
    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x0b12 : 0x0b2a, regs.b !== 0 ? 13 : 8); // djnz 0x0b12
  } while (regs.b !== 0);

  m.ret(); // 0x0b2a
}
