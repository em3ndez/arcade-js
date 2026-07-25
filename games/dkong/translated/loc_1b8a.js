// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1b8a  (ROM 0x1B8A–0x1BB1) — write the jump record, set sprite, snapshot Y, sound.
 */
export function loc_1b8a(m) {
  const { regs, mem } = m;
  regs.xor(regs.a); // A = 0
  m.step(0x1b8b, 4); // xor a
  mem.write8(regs.hl, regs.b);
  m.step(0x1b8c, 7); // ld (hl),b -- (0x6210)=B
  regs.l = regs.inc8(regs.l);
  m.step(0x1b8d, 4); // inc l
  mem.write8(regs.hl, regs.c);
  m.step(0x1b8e, 7); // ld (hl),c -- (0x6211)=C
  regs.l = regs.inc8(regs.l);
  m.step(0x1b8f, 4); // inc l
  mem.write8(regs.hl, 0x01);
  m.step(0x1b91, 10); // ld (hl),0x01 -- (0x6212)=1
  regs.l = regs.inc8(regs.l);
  m.step(0x1b92, 4); // inc l
  mem.write8(regs.hl, 0x48);
  m.step(0x1b94, 10); // ld (hl),0x48 -- (0x6213)=0x48
  regs.l = regs.inc8(regs.l);
  m.step(0x1b95, 4); // inc l
  mem.write8(regs.hl, regs.a);
  m.step(0x1b96, 7); // ld (hl),a -- (0x6214)=0
  mem.write8(0x6204, regs.a);
  m.step(0x1b99, 13); // ld (0x6204),a
  mem.write8(0x6206, regs.a);
  m.step(0x1b9c, 13); // ld (0x6206),a
  regs.a = mem.read8(0x6207);
  m.step(0x1b9f, 13); // ld a,(0x6207)
  regs.and(0x80);
  m.step(0x1ba1, 7); // and 0x80
  regs.or(0x0e);
  m.step(0x1ba3, 7); // or 0x0e
  mem.write8(0x6207, regs.a);
  m.step(0x1ba6, 13); // ld (0x6207),a
  regs.a = mem.read8(0x6205);
  m.step(0x1ba9, 13); // ld a,(0x6205)
  mem.write8(0x620e, regs.a);
  m.step(0x1bac, 13); // ld (0x620e),a
  regs.hl = 0x6081;
  m.step(0x1baf, 10); // ld hl,0x6081
  mem.write8(regs.hl, 0x03); // sound trigger
  m.step(0x1bb1, 10); // ld (hl),0x03
  m.ret(10);
}
