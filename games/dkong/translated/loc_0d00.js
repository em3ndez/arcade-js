// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0d00  (ROM 0x0D00–0x0D16) — 8-record block-fill from the 0x0D17 table: each record fills 2 cells with a descending 0xB8.
 */
export function loc_0d00(m) {
  const { regs, mem } = m;
  regs.b = 0x08;
  m.step(0x0d02, 7); // ld b,0x08
  regs.hl = 0x0d17;
  m.step(0x0d05, 10); // ld hl,0x0d17
  do {
    regs.a = 0xb8;
    m.step(0x0d07, 7); // ld a,0xb8
    regs.c = 0x02;
    m.step(0x0d09, 7); // ld c,0x02
    regs.e = mem.read8(regs.hl);
    m.step(0x0d0a, 7); // ld e,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0d0b, 6); // inc hl
    regs.d = mem.read8(regs.hl);
    m.step(0x0d0c, 7); // ld d,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0d0d, 6); // inc hl
    do {
      mem.write8(regs.de, regs.a);
      m.step(0x0d0e, 7); // ld (de),a
      regs.a = regs.dec8(regs.a);
      m.step(0x0d0f, 4); // dec a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x0d10, 6); // inc de
      regs.c = regs.dec8(regs.c);
      m.step(0x0d11, 4); // dec c
      m.step(regs.c !== 0 ? 0x0d0d : 0x0d14, 10); // jp nz
    } while (regs.c !== 0);
    regs.djnz();
    m.step(regs.b ? 0x0d05 : 0x0d16, regs.b ? 13 : 8);
  } while (regs.b);
  m.ret(10);
}
