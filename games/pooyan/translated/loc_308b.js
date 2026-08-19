// SPDX-License-Identifier: GPL-3.0-only
//
// loc_308b  (ROM 0x308b-0x30ea) -- hunter-formation manager (called from 0x241e and others). Aborts
// unless (0x8f04) is set. While (0x8f08)==0 it scans the 0x11 records at 0x8ae0 for a launch-ready one
// (state 0 or 5 with (ix+1)==0), registers its pointer into the 0x8920 slot table, marks it state 5,
// and once the slot table fills (IYL reaches 0x28) arms (0x8f08)=1/(0x8f09)=0x20. Once (0x8f08) is
// set it pushes the shared epilogue loc_32bd and dispatches (0x8f08&3)-1 via rst 0x28 into table
// 0x30eb {0->0x30f1, 1->0x316e, 2->0x3266}.
export function loc_308b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f04); m.step(0x308e, 13); // 308b  ld a,(0x8f04)
  regs.and(regs.a); m.step(0x308f, 4);
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x3090, 5);
  regs.a = mem.read8(0x8f08); m.step(0x3093, 13); // 3090  ld a,(0x8f08)
  regs.and(regs.a); m.step(0x3094, 4);
  if (regs.fNZ) {
    m.step(0x30e0, 12);
    regs.hl = 0x32bd; m.step(0x30e3, 10);
    m.push16(regs.hl); m.step(0x30e4, 11); // 30e3  push hl (epilogue loc_32bd)
    regs.a = mem.read8(0x8f08); m.step(0x30e7, 13); // 30e4  ld a,(0x8f08)
    regs.and(0x03); m.step(0x30e9, 7);
    regs.a = regs.dec8(regs.a); m.step(0x30ea, 4);
    m.push16(0x30eb); m.step(0x0028, 11); // 30ea  rst 0x28 (table base 0x30eb)
    m.call(0x0028); // dispatch; the handler's ret pops the pushed 0x32bd epilogue
    return m.call(0x32bd); // run the epilogue loc_32bd (dissolved) -- its ret returns to loc_308b's caller
  }
  m.step(0x3096, 7);
  regs.ix = 0x8ae0; m.step(0x309a, 14);
  regs.iy = 0x8920; m.step(0x309e, 14);
  regs.de = 0x0018; m.step(0x30a1, 10);
  regs.b = 0x11; m.step(0x30a3, 7);
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x30a6, 19); // 30a3  ld a,(ix+0)
    regs.and(regs.a); m.step(0x30a7, 4);
    let cand = false;
    if (regs.fZ) {
      m.step(0x30b6, 12); cand = true;
    } else {
      m.step(0x30a9, 7);
      regs.cp(0x05); m.step(0x30ab, 7);
      if (regs.fZ) { m.step(0x30b6, 12); cand = true; }
      else { m.step(0x30ad, 7); } // fall to 0x30ad
    }
    if (cand) {
      regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x30b9, 19); // 30b6  ld a,(ix+1)
      regs.and(regs.a); m.step(0x30ba, 4);
      if (regs.fNZ) {
        m.step(0x30ad, 12);
      } else {
        m.step(0x30bc, 7);
        m.push16(regs.ix); m.step(0x30be, 15);
        regs.hl = m.pop16(); m.step(0x30bf, 10);
        mem.write8((regs.iy + 0x00) & 0xffff, regs.l); m.step(0x30c2, 19); // 30bf  ld (iy+0),l
        mem.write8((regs.iy + 0x01) & 0xffff, regs.h); m.step(0x30c5, 19); // 30c2  ld (iy+1),h
        mem.write8((regs.ix + 0x00) & 0xffff, 0x05); m.step(0x30c9, 19); // 30c5  ld (ix+0),0x05
        mem.write8((regs.ix + 0x02) & 0xffff, 0x10); m.step(0x30cd, 19); // 30c9  ld (ix+2),0x10
        regs.iy = (regs.iy + 1) & 0xffff; m.step(0x30cf, 10);
        regs.iy = (regs.iy + 1) & 0xffff; m.step(0x30d1, 10);
        regs.a = regs.iy & 0xff; m.step(0x30d3, 8);
        regs.cp(0x28); m.step(0x30d5, 7);
        if (regs.fNZ) {
          m.step(0x30ad, 12);
        } else {
          m.step(0x30d7, 7);
          regs.hl = 0x8f08; m.step(0x30da, 10);
          mem.write8(regs.hl, 0x01); m.step(0x30dc, 10); // 30da  ld (hl),0x01
          regs.hl = (regs.hl + 1) & 0xffff; m.step(0x30dd, 6);
          mem.write8(regs.hl, 0x20); m.step(0x30df, 10); // 30dd  ld (hl),0x20
          m.ret(); return;
        }
      }
    }
    regs.addIx(regs.de); m.step(0x30af, 15);
    if (regs.djnz() !== 0) { m.step(0x30a3, 13); continue; }
    m.step(0x30b1, 8); break;
  }
  regs.xor(regs.a); m.step(0x30b2, 4);
  mem.write8(0x8920, regs.a); m.step(0x30b5, 13); // 30b2  ld (0x8920),a
  m.ret();
}
