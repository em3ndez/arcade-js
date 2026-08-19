// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2be5  (ROM 0x2be5-0x2c2b) -- try to activate one bonus/formation slot (IX record) for loc_2bb3.
// If the slot is occupied (low bit of (ix+0)|(ix+1) set) it returns normally (true) and the loop
// continues. Otherwise it seeds the record (state/anim/coords, (ix+7) from (0x8903) parity, a queued
// display command loc_381e, and a 0x8d30 counter derived from (0x8903)), then `pop af; ret` to abort
// loc_2bb3's loop (false). Boolean caller-skip protocol. loc_381e = pattern A.
export function loc_2be5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x2be8, 19); // 2be5  ld a,(ix+0)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x2beb, 19); // 2be8  or (ix+1)
  regs.rrca(); m.step(0x2bec, 4);
  if (regs.fC) { m.ret(11); return true; } // 2bec  ret c -- occupied, loop continues
  m.step(0x2bed, 5);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01); m.step(0x2bf1, 19); // 2bed  ld (ix+0),0x01
  regs.xor(regs.a); m.step(0x2bf2, 4);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x11); m.step(0x2bf6, 19); // 2bf2  ld (ix+0x02),0x11
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x2bf9, 19); // 2bf6  ld (ix+0x03),a
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x2bfc, 19); // 2bf9  ld (ix+0x05),a
  mem.write8((regs.ix + 0x04) & 0xffff, 0x1c); m.step(0x2c00, 19); // 2bfc  ld (ix+0x04),0x1c
  mem.write8((regs.ix + 0x06) & 0xffff, 0x03); m.step(0x2c04, 19); // 2c00  ld (ix+0x06),0x03
  regs.hl = 0x8903; m.step(0x2c07, 10);
  regs.decMem8(mem, regs.hl); m.step(0x2c08, 11); // 2c07  dec (hl)
  regs.bit(0, mem.read8(regs.hl)); m.step(0x2c0a, 12); // 2c08  bit 0,(hl)
  if (regs.fZ) {
    m.step(0x2c0d, 12);
  } else {
    m.step(0x2c0c, 7);
    regs.a = regs.inc8(regs.a); m.step(0x2c0d, 4);
  }
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a); m.step(0x2c10, 19); // 2c0d  ld (ix+0x07),a
  regs.de = 0x2d5d; m.step(0x2c13, 10);
  m.push16(0x2c16); m.step(0x381e, 17); m.call(0x381e); // 2c13  call 0x381e (pattern A)
  regs.a = mem.read8(0x8903); m.step(0x2c19, 13); // 2c16  ld a,(0x8903)
  regs.cp(0x0a); m.step(0x2c1b, 7);
  if (regs.fC) {
    m.step(0x2c1f, 12);
  } else {
    m.step(0x2c1d, 7);
    regs.a = 0x0a; m.step(0x2c1f, 7); // 2c1d  ld a,0x0a (clamp)
  }
  regs.b = regs.a; m.step(0x2c20, 4);
  regs.a = 0x20; m.step(0x2c22, 7);
  regs.sub(regs.b); m.step(0x2c23, 4);
  mem.write8(0x8d30, regs.a); m.step(0x2c26, 13); // 2c23  ld (0x8d30),a
  mem.write8((regs.ix + 0x09) & 0xffff, 0x10); m.step(0x2c2a, 19); // 2c26  ld (ix+0x09),0x10
  regs.af = m.pop16(); m.step(0x2c2b, 10); // 2c2a  pop af (discard caller return)
  m.ret(); return false; // 2c2b  ret -- caller-skip (aborts loc_2bb3's loop)
}
