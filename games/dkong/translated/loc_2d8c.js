// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d8c  (ROM 0x2D8C–0x2DD9) — 0x7F terminator: reinit the object record (IX+0..+14) + call 0x004E + rst 0x38.
 */
export function loc_2d8c(m) {
  const { regs, mem } = m;
  regs.hl = 0x39c3;
  m.step(0x2d8f, 10); // ld hl,0x39c3
  mem.write16(0x62a8, regs.hl);
  m.step(0x2d92, 16); // ld (0x62a8),hl
  mem.write8((regs.ix + 0x01) & 0xffff, 0x01);
  m.step(0x2d96, 19); // ld (ix+0x01),0x01
  regs.a = mem.read8(0x6382);
  m.step(0x2d99, 13); // ld a,(0x6382)
  regs.rrca();
  m.step(0x2d9a, 4); // rrca
  if (regs.fC) {
    m.step(0x2da5, 10); // jp c,0x2da5 (keep ix+1=1)
  } else {
    m.step(0x2d9d, 10);
    mem.write8((regs.ix + 0x01) & 0xffff, 0x00);
    m.step(0x2da1, 19); // ld (ix+0x01),0x00
    mem.write8((regs.ix + 0x02) & 0xffff, 0x02);
    m.step(0x2da5, 19); // ld (ix+0x02),0x02
  }
  // -- loc_2da5 --
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  m.step(0x2da9, 19); // ld (ix+0x00),0x01
  mem.write8((regs.ix + 0x0f) & 0xffff, 0x01);
  m.step(0x2dad, 19); // ld (ix+0x0f),0x01
  regs.xor(regs.a);
  m.step(0x2dae, 4); // xor a
  mem.write8((regs.ix + 0x10) & 0xffff, regs.a);
  m.step(0x2db1, 19); // ld (ix+0x10),a
  mem.write8((regs.ix + 0x11) & 0xffff, regs.a);
  m.step(0x2db4, 19); // ld (ix+0x11),a
  mem.write8((regs.ix + 0x12) & 0xffff, regs.a);
  m.step(0x2db7, 19); // ld (ix+0x12),a
  mem.write8((regs.ix + 0x13) & 0xffff, regs.a);
  m.step(0x2dba, 19); // ld (ix+0x13),a
  mem.write8((regs.ix + 0x14) & 0xffff, regs.a);
  m.step(0x2dbd, 19); // ld (ix+0x14),a
  mem.write8(0x6393, regs.a);
  m.step(0x2dc0, 13); // ld (0x6393),a
  mem.write8(0x6392, regs.a);
  m.step(0x2dc3, 13); // ld (0x6392),a
  regs.a = mem.read8(regs.de);
  m.step(0x2dc4, 7); // ld a,(de)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x2dc7, 19); // ld (ix+0x03),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x2dc8, 6); // inc de
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x2dc9, 6); // inc de
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x2dca, 6); // inc de
  regs.a = mem.read8(regs.de);
  m.step(0x2dcb, 7); // ld a,(de)
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
  m.step(0x2dce, 19); // ld (ix+0x05),a
  regs.hl = 0x385c;
  m.step(0x2dd1, 10); // ld hl,0x385c
  m.push16(0x2dd4); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.hl = 0x690b;
  m.step(0x2dd7, 10); // ld hl,0x690b
  regs.c = 0xfc;
  m.step(0x2dd9, 7); // ld c,0xfc
  m.push16(0x2dda); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 = CALL loc_0038
  m.ret(); // ret (EXIT: reinit, 0x2DDA)
}
