// SPDX-License-Identifier: GPL-3.0-only

// loc_2af3  (ROM 0x2AF3-0x2B57) — IX sprite-object arm. Gated on (ix+0x06); calls loc_2ae6, derives the
// object's on-screen X into (iy+0x00) from (ix+0x04) vs 0x60 (either (0x8014)-(ix+0x02) or (ix+0x03)),
// mirrors (ix+0x04) into (iy+0x03)/(iy+0x07), sets (iy+0x04) from 0x0F/0xF1 + C, and on the wrap
// conditions zeroes the ix[0..14] / iy[0..6] blocks via ldir and stores (ix+0x0a)=0x20.
export function loc_2af3(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2af6, 19); // ld a,(ix+0x06)
  regs.or(regs.a);
  m.step(0x2af7, 4);
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x2af8, 5);
  m.push16(0x2afb);
  m.step(0x2ae6, 17); // call 0x2ae6
  m.call(0x2ae6);

  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x2afe, 19); // ld a,(ix+0x04)
  regs.cp(0x60);
  m.step(0x2b00, 7);
  if (regs.fNC) {
    m.step(0x2b0e, 12); // jr nc,0x2b0e
    return block_2b0e();
  }
  m.step(0x2b02, 7);
  regs.a = mem.read8(0x8014);
  m.step(0x2b05, 13);
  regs.sub(mem.read8((regs.ix + 0x02) & 0xffff));
  m.step(0x2b08, 19); // sub (ix+0x02)
  regs.c = regs.a;
  m.step(0x2b09, 4);
  mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
  m.step(0x2b0c, 19); // ld (iy+0x00),a
  m.step(0x2b14, 12); // jr 0x2b14
  return block_2b14();

  function block_2b0e() {
    regs.c = mem.read8((regs.ix + 0x03) & 0xffff);
    m.step(0x2b11, 19); // ld c,(ix+0x03)
    mem.write8((regs.iy + 0x00) & 0xffff, regs.c);
    m.step(0x2b14, 19); // ld (iy+0x00),c
    return block_2b14();
  }

  function block_2b14() {
    regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
    m.step(0x2b17, 19); // ld a,(ix+0x04)
    mem.write8((regs.iy + 0x03) & 0xffff, regs.a);
    m.step(0x2b1a, 19); // ld (iy+0x03),a
    mem.write8((regs.iy + 0x07) & 0xffff, regs.a);
    m.step(0x2b1d, 19); // ld (iy+0x07),a
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
    m.step(0x2b20, 19); // ld a,(ix+0x05)
    regs.or(regs.a);
    m.step(0x2b21, 4);
    if (regs.fNZ) {
      m.step(0x2b2d, 12); // jr nz,0x2b2d
      return block_2b2d();
    }
    m.step(0x2b23, 7);
    regs.a = 0x0f;
    m.step(0x2b25, 7);
    regs.add(regs.c);
    m.step(0x2b26, 4);
    mem.write8((regs.iy + 0x04) & 0xffff, regs.a);
    m.step(0x2b29, 19); // ld (iy+0x04),a
    regs.a = regs.inc8(regs.a);
    m.step(0x2b2a, 4);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x2b2b, 5);
    m.step(0x2b36, 12); // jr 0x2b36
    return block_2b36();
  }

  function block_2b2d() {
    regs.a = 0xf1;
    m.step(0x2b2f, 7);
    regs.add(regs.c);
    m.step(0x2b30, 4);
    mem.write8((regs.iy + 0x04) & 0xffff, regs.a);
    m.step(0x2b33, 19); // ld (iy+0x04),a
    regs.a = regs.c;
    m.step(0x2b34, 4);
    regs.or(regs.a);
    m.step(0x2b35, 4);
    if (regs.fNZ) {
      m.ret(11);
      return;
    }
    m.step(0x2b36, 5);
    return block_2b36();
  }

  function block_2b36() {
    regs.a = mem.read8((regs.ix + 0x07) & 0xffff);
    m.step(0x2b39, 19); // ld a,(ix+0x07)
    regs.or(regs.a);
    m.step(0x2b3a, 4);
    if (regs.fZ) {
      m.ret(11);
      return;
    }
    m.step(0x2b3b, 5);
    m.push16(regs.ix);
    m.step(0x2b3d, 15); // push ix
    regs.hl = m.pop16();
    m.step(0x2b3e, 10); // pop hl -- HL = IX
    regs.d = regs.h;
    m.step(0x2b3f, 4);
    regs.e = regs.l;
    m.step(0x2b40, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x2b41, 4); // DE = IX+1
    regs.bc = 0x000f;
    m.step(0x2b44, 10);
    mem.write8(regs.hl, regs.b);
    m.step(0x2b45, 7); // ld (hl),b -- seed 0 at (IX)
    m.ldirAt(0x2b45, 0x2b47); // zero ix[1..15] from ix[0]
    regs.bc = 0x0007;
    m.step(0x2b4a, 10);
    m.push16(regs.iy);
    m.step(0x2b4c, 15); // push iy
    regs.hl = m.pop16();
    m.step(0x2b4d, 10); // pop hl -- HL = IY
    regs.d = regs.h;
    m.step(0x2b4e, 4);
    regs.e = regs.l;
    m.step(0x2b4f, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x2b50, 4); // DE = IY+1
    mem.write8(regs.hl, regs.b);
    m.step(0x2b51, 7); // ld (hl),b -- seed 0 at (IY)
    m.ldirAt(0x2b51, 0x2b53); // zero iy[1..7] from iy[0]
    mem.write8((regs.ix + 0x0a) & 0xffff, 0x20);
    m.step(0x2b57, 19); // ld (ix+0x0a),0x20
    m.ret();
  }
}
