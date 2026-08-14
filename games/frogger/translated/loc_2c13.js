// SPDX-License-Identifier: GPL-3.0-only

// loc_2c13  (ROM 0x2C13-0x2CA7) — IX sprite-object arm. Gated on (0x83b7)>=3 and (ix+0x06)==0; draws
// three bytes from the blit helper loc_0aee (as a spawn RNG), gates on one, derives (ix+0x04) from
// another, then indexes ROM tables 0x2CE6 / 0x2CDC to a work-RAM cell and computes the object's
// (ix+0x00..0x03) position via the 0x2C6D scan loop, finally arming it: (ix+0x06)=1, (ix+0x09)=8.
export function loc_2c13(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83b7);
  m.step(0x2c16, 13);
  regs.cp(0x03);
  m.step(0x2c18, 7);
  if (regs.fC) {
    m.ret(11);
    return;
  }
  m.step(0x2c19, 5);
  regs.c = regs.a;
  m.step(0x2c1a, 4);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2c1d, 19); // ld a,(ix+0x06)
  regs.or(regs.a);
  m.step(0x2c1e, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x2c1f, 5);
  m.push16(0x2c22);
  m.step(0x0aee, 17); // call 0x0aee
  m.call(0x0aee);
  regs.b = regs.a;
  m.step(0x2c23, 4);
  regs.a = regs.c;
  m.step(0x2c24, 4);
  regs.add(regs.a);
  m.step(0x2c25, 4);
  regs.add(regs.a);
  m.step(0x2c26, 4);
  regs.add(regs.a);
  m.step(0x2c27, 4); // A = 8*C
  regs.add(0x80);
  m.step(0x2c29, 7);
  regs.cp(regs.b);
  m.step(0x2c2a, 4);
  if (regs.fC) {
    m.ret(11);
    return;
  }
  m.step(0x2c2b, 5);
  regs.c = 0x40;
  m.step(0x2c2d, 7);
  m.push16(0x2c30);
  m.step(0x0aee, 17); // call 0x0aee
  m.call(0x0aee);
  regs.and(0x07);
  m.step(0x2c32, 7);
  regs.cp(0x05);
  m.step(0x2c34, 7);
  if (regs.fNC) {
    m.ret(11);
    return;
  }
  m.step(0x2c35, 5);
  regs.c = regs.a;
  m.step(0x2c36, 4);
  regs.rrca();
  m.step(0x2c37, 4);
  regs.rrca();
  m.step(0x2c38, 4);
  regs.rrca();
  m.step(0x2c39, 4);
  regs.rrca();
  m.step(0x2c3a, 4); // A = nibble-swap(C), C in [0,4]
  regs.add(0x30);
  m.step(0x2c3c, 7);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a);
  m.step(0x2c3f, 19); // ld (ix+0x04),a
  m.push16(0x2c42);
  m.step(0x0aee, 17); // call 0x0aee
  m.call(0x0aee);
  regs.b = regs.a;
  m.step(0x2c43, 4);
  regs.a = regs.c;
  m.step(0x2c44, 4);
  regs.add(regs.a);
  m.step(0x2c45, 4);
  regs.e = regs.a;
  m.step(0x2c46, 4);
  regs.d = 0x00;
  m.step(0x2c48, 7);
  regs.hl = 0x2ce6;
  m.step(0x2c4b, 10);
  regs.addHl(regs.de);
  m.step(0x2c4c, 11); // HL = &table_2ce6[2*C]
  regs.e = mem.read8(regs.hl);
  m.step(0x2c4d, 7);
  regs.l = regs.inc8(regs.l);
  m.step(0x2c4e, 4);
  regs.l = mem.read8(regs.hl);
  m.step(0x2c4f, 7);
  regs.h = 0x80;
  m.step(0x2c51, 7); // HL = 0x80:ptr -- a work-RAM cell
  mem.write8((regs.ix + 0x0b) & 0xffff, regs.l);
  m.step(0x2c54, 19); // ld (ix+0x0b),l
  regs.a = mem.read8(regs.hl);
  m.step(0x2c55, 7);
  regs.d = regs.a;
  m.step(0x2c56, 4);
  regs.a = regs.c;
  m.step(0x2c57, 4);
  regs.add(regs.a);
  m.step(0x2c58, 4);
  regs.c = regs.a;
  m.step(0x2c59, 4);
  regs.b = 0x00;
  m.step(0x2c5b, 7);
  regs.hl = 0x2cdc;
  m.step(0x2c5e, 10);
  regs.addHl(regs.bc);
  m.step(0x2c5f, 11); // HL = &table_2cdc[2*C]
  regs.c = mem.read8(regs.hl);
  m.step(0x2c60, 7);
  regs.l = regs.inc8(regs.l);
  m.step(0x2c61, 4);
  regs.h = mem.read8(regs.hl);
  m.step(0x2c62, 7);
  regs.l = regs.c;
  m.step(0x2c63, 4); // HL = 16-bit ptr from table_2cdc
  regs.a = mem.read8(regs.hl);
  m.step(0x2c64, 7);
  regs.rrca();
  m.step(0x2c65, 4);
  regs.rrca();
  m.step(0x2c66, 4);
  regs.sub(0x10);
  m.step(0x2c68, 7);
  regs.c = regs.a;
  m.step(0x2c69, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x2c6a, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x2c6b, 4);
  regs.b = mem.read8(regs.hl);
  m.step(0x2c6c, 7);
  regs.a = regs.d;
  m.step(0x2c6d, 4);

  return block_2c6d();

  function block_2c6d() {
    for (;;) {
      regs.sub(regs.e);
      m.step(0x2c6e, 4); // sub e
      if (regs.fC) {
        m.ret(11);
        return;
      }
      m.step(0x2c6f, 5);
      regs.sub(regs.c);
      m.step(0x2c70, 4); // sub c
      if (regs.fC) {
        m.step(0x2c74, 12); // jr c,0x2c74
        return block_2c74();
      }
      m.step(0x2c72, 7);
      if (m.regs.djnz() !== 0) {
        m.step(0x2c6d, 13);
        continue;
      }
      m.step(0x2c74, 8);
      return block_2c74();
    }
  }

  function block_2c74() {
    regs.add(regs.c);
    m.step(0x2c75, 4);
    regs.b = regs.a;
    m.step(0x2c76, 4);
    regs.l = mem.read8((regs.ix + 0x0b) & 0xffff);
    m.step(0x2c79, 19); // ld l,(ix+0x0b)
    regs.h = 0x80;
    m.step(0x2c7b, 7);
    regs.a = mem.read8(regs.hl);
    m.step(0x2c7c, 7);
    mem.write8((regs.ix + 0x02) & 0xffff, regs.a);
    m.step(0x2c7f, 19); // ld (ix+0x02),a
    regs.sub(regs.b);
    m.step(0x2c80, 4);
    mem.write8((regs.ix + 0x01) & 0xffff, regs.a);
    m.step(0x2c83, 19); // ld (ix+0x01),a
    regs.add(regs.c);
    m.step(0x2c84, 4);
    mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
    m.step(0x2c87, 19); // ld (ix+0x00),a
    m.push16(0x2c8a);
    m.step(0x0aee, 17); // call 0x0aee
    m.call(0x0aee);
    regs.rrca();
    m.step(0x2c8b, 4);
    if (regs.fC) {
      m.step(0x2c97, 12); // jr c,0x2c97
      return block_2c97();
    }
    m.step(0x2c8d, 7);
    mem.write8((regs.ix + 0x05) & 0xffff, 0x80);
    m.step(0x2c91, 19); // ld (ix+0x05),0x80
    mem.write8((regs.ix + 0x03) & 0xffff, 0xf0);
    m.step(0x2c95, 19); // ld (ix+0x03),0xf0
    m.step(0x2c9f, 12); // jr 0x2c9f
    return block_2c9f();
  }

  function block_2c97() {
    mem.write8((regs.ix + 0x05) & 0xffff, 0x00);
    m.step(0x2c9b, 19); // ld (ix+0x05),0x00
    mem.write8((regs.ix + 0x03) & 0xffff, 0x00);
    m.step(0x2c9f, 19); // ld (ix+0x03),0x00
    return block_2c9f();
  }

  function block_2c9f() {
    mem.write8((regs.ix + 0x06) & 0xffff, 0x01);
    m.step(0x2ca3, 19); // ld (ix+0x06),0x01
    mem.write8((regs.ix + 0x09) & 0xffff, 0x08);
    m.step(0x2ca7, 19); // ld (ix+0x09),0x08
    m.ret();
  }
}
