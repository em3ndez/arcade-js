// SPDX-License-Identifier: GPL-3.0-only

// loc_3775  (ROM 0x3775-0x379c) -- end-of-move dispatch. When the game phase (0x880a)==5, finish the
// slot only once its counter (ix+6) reaches 0 (tail-jp 0x3553). Otherwise, once (ix+6) < 2, clear the
// anim latch (ix+8) and pick the turn-around anim (0x3829 or 0x3847 per (ix+7) bit1), then tail-jp
// 0x381e. (ix+6) >= 2 (or a non-zero counter in the ==5 case) returns without acting.
export function loc_3775(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x880a);                       m.step(0x3778, 13);
  regs.cp(0x05);                                    m.step(0x377a, 7);
  if (regs.fZ) {
    m.step(0x3795, 12);                             // jr z -- phase 5
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff);  m.step(0x3798, 19);
    regs.and(regs.a);                               m.step(0x3799, 4);
    if (regs.fNZ) { return m.ret(11); }             // ret nz -- counter not yet 0
    m.step(0x379a, 5);
    m.step(0x3553, 10);                             // jp 0x3553 (tail)
    return m.call(0x3553);
  }
  m.step(0x377c, 7);                                // jr z not taken
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);    m.step(0x377f, 19);
  regs.cp(0x02);                                    m.step(0x3781, 7);
  if (regs.fNC) { return m.ret(11); }               // ret nc -- (ix+6) >= 2
  m.step(0x3782, 5);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x00);      m.step(0x3786, 19);
  regs.de = 0x3829;                                 m.step(0x3789, 10);
  regs.bit(1, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x378d, 20);
  if (regs.fZ) {
    m.step(0x3792, 12);                             // jr z -- (ix+7) bit1 clear
  } else {
    m.step(0x378f, 7);
    regs.de = 0x3847;                               m.step(0x3792, 10);
  }
  m.step(0x381e, 10);                               // jp 0x381e (tail)
  return m.call(0x381e);
}
