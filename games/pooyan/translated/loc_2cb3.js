// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2cb3  (ROM 0x2cb3-0x2cff) -- hunter dispatch state 1 (rst 0x2c50[1]). Advances the hunter's
// script pointer (ix+0x16:0x17): 0xff bytes latch into (ix+0x15); a 0x88 byte advances the record
// state and queues a display command (loc_381e); any other byte is a signed delta applied to the
// horizontal position (ix+0x03/0x04), its sign chosen by (ix+0x15) bit0. Boolean protocol: all rets
// return true (normal). loc_4006/381e are pattern A.
export function loc_2cb3(m) {
  const { regs, mem } = m;

  m.push16(0x2cb6); m.step(0x4006, 17); m.call(0x4006);
  regs.l = mem.read8((regs.ix + 0x16) & 0xffff); m.step(0x2cb9, 19); // 2cb6  ld l,(ix+0x16)
  regs.h = mem.read8((regs.ix + 0x17) & 0xffff); m.step(0x2cbc, 19); // 2cb9  ld h,(ix+0x17)
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x2cbd, 7); // 2cbc  ld a,(hl)
    regs.cp(0xff); m.step(0x2cbf, 7);
    if (regs.fNZ) { m.step(0x2cc7, 12); break; }
    m.step(0x2cc1, 7);
    mem.write8((regs.ix + 0x15) & 0xffff, regs.a); m.step(0x2cc4, 19); // 2cc1  ld (ix+0x15),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2cc5, 6);
    m.step(0x2cbc, 12);
  }
  regs.cp(0x88); m.step(0x2cc9, 7);
  if (regs.fNZ) {
    m.step(0x2cd9, 12);
  } else {
    m.step(0x2ccb, 7);
    regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2cce, 23); // 2ccb  inc (ix+0x02)
    regs.de = 0x2d5d; m.step(0x2cd1, 10);
    m.push16(0x2cd4); m.step(0x381e, 17); m.call(0x381e); // 2cd1  call 0x381e (pattern A)
    mem.write8((regs.ix + 0x11) & 0xffff, 0x20); m.step(0x2cd8, 19); // 2cd4  ld (ix+0x11),0x20
    m.ret(); return true;
  }
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2cda, 6);
  mem.write8((regs.ix + 0x16) & 0xffff, regs.l); m.step(0x2cdd, 19); // 2cda  ld (ix+0x16),l
  mem.write8((regs.ix + 0x17) & 0xffff, regs.h); m.step(0x2ce0, 19); // 2cdd  ld (ix+0x17),h
  regs.bit(0, mem.read8((regs.ix + 0x15) & 0xffff)); m.step(0x2ce4, 20); // 2ce0  bit 0,(ix+0x15)
  if (regs.fNZ) {
    m.step(0x2cf4, 12);
    regs.add(mem.read8((regs.ix + 0x03) & 0xffff)); m.step(0x2cf7, 19); // 2cf4  add a,(ix+0x03)
    if (regs.fNC) {
      m.step(0x2cfc, 12);
    } else {
      m.step(0x2cf9, 7);
      regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x2cfc, 23); // 2cf9  inc (ix+0x04)
    }
    mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x2cff, 19); // 2cfc  ld (ix+0x03),a
    m.ret(); return true;
  }
  m.step(0x2ce6, 7);
  regs.b = regs.a; m.step(0x2ce7, 4);
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x2cea, 19); // 2ce7  ld a,(ix+0x03)
  regs.sub(regs.b); m.step(0x2ceb, 4);
  if (regs.fNC) {
    m.step(0x2cf0, 12);
  } else {
    m.step(0x2ced, 7);
    regs.decMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x2cf0, 23); // 2ced  dec (ix+0x04)
  }
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x2cf3, 19); // 2cf0  ld (ix+0x03),a
  m.ret(); return true;
}
