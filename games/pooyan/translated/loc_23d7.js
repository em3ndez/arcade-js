// SPDX-License-Identifier: GPL-3.0-only
//
// loc_23d7  (ROM 0x23d7-0x23eb) -- derive three sprite Y coordinates from the actor's base Y
// (ix+0x04) into the 0x8a80 sprite record: (ix+0x4c)=Y, (ix+0x34)=Y-0x10, (ix+0x1c)=Y-0x10+0x0a.
// Plain-ret helper (pattern A callee) invoked by loc_2334 / loc_236a / and 0x290f / 0x32f2.
export function loc_23d7(m) {
  const { regs, mem } = m;

  regs.ix = 0x8a80; m.step(0x23db, 14); // 23d7  ld ix,0x8a80
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x23de, 19); // 23db  ld a,(ix+4)
  mem.write8((regs.ix + 0x4c) & 0xffff, regs.a); m.step(0x23e1, 19); // 23de  ld (ix+0x4c),a
  regs.sub(0x10); m.step(0x23e3, 7); // 23e1  sub 0x10
  mem.write8((regs.ix + 0x34) & 0xffff, regs.a); m.step(0x23e6, 19); // 23e3  ld (ix+0x34),a
  regs.add(0x0a); m.step(0x23e8, 7); // 23e6  add a,0x0a
  mem.write8((regs.ix + 0x1c) & 0xffff, regs.a); m.step(0x23eb, 19); // 23e8  ld (ix+0x1c),a
  m.ret(); // 23eb  ret
}
