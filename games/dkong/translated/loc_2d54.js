// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d54  (ROM 0x2D54–0x2D82) — char loop body: write a 4-byte record via DE=(0x62AC), IX=(0x62AA); 0x7F -> loc_2d8c.
 */
export function loc_2d54(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(regs.hl);
  m.step(0x2d55, 7); // ld a,(hl)
  regs.ix = mem.read16(0x62aa);
  m.step(0x2d59, 20); // ld ix,(0x62aa) -- 20T
  regs.de = mem.read16(0x62ac);
  m.step(0x2d5d, 20); // ld de,(0x62ac)
  regs.cp(0x7f);
  m.step(0x2d5f, 7); // cp 0x7f
  if (regs.fZ) { m.step(0x2d8c, 10); return m.call(0x2d8c); } // jp z,0x2d8c (terminator)
  m.step(0x2d62, 10);
  regs.c = regs.a;
  m.step(0x2d63, 4); // ld c,a -- C = char (bit7 = attribute)
  regs.and(0x7f);
  m.step(0x2d65, 7); // and 0x7f
  mem.write8(regs.de, regs.a);
  m.step(0x2d66, 7); // ld (de),a -- store char
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff);
  m.step(0x2d69, 19); // ld a,(ix+0x07)
  regs.bit(7, regs.c);
  m.step(0x2d6b, 8); // bit 7,c
  if (regs.fZ) {
    m.step(0x2d70, 10); // jp z,0x2d70 (bit7 clear -> skip xor)
  } else {
    m.step(0x2d6e, 10);
    regs.xor(0x03);
    m.step(0x2d70, 7); // xor 0x03 -- flip bits 0,1
  }
  // -- loc_2d70 --
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x2d71, 6); // inc de
  mem.write8(regs.de, regs.a);
  m.step(0x2d72, 7); // ld (de),a
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a);
  m.step(0x2d75, 19); // ld (ix+0x07),a
  regs.a = mem.read8((regs.ix + 0x08) & 0xffff);
  m.step(0x2d78, 19); // ld a,(ix+0x08)
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x2d79, 6); // inc de
  mem.write8(regs.de, regs.a);
  m.step(0x2d7a, 7); // ld (de),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2d7b, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x2d7c, 7); // ld a,(hl)
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x2d7d, 6); // inc de
  mem.write8(regs.de, regs.a);
  m.step(0x2d7e, 7); // ld (de),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2d7f, 6); // inc hl
  mem.write16(0x62a8, regs.hl);
  m.step(0x2d82, 16); // ld (0x62a8),hl
  m.ret(); // ret (EXIT: per-char, 0x2D82)
}
