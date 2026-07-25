// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2303  (ROM 0x2303–0x2319) — sub_22cb diff-3/4 velocity: (ix+0x11)=frame, (ix+0x10)=dir sign (playerX vs objX). IX live-in.
 */
export function loc_2303(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6018);
  m.step(0x2306, 13);
  mem.write8((regs.ix + 0x11) & 0xffff, regs.a);
  m.step(0x2309, 19); // (ix+0x11) = frame
  regs.a = mem.read8(0x6203);
  m.step(0x230c, 13);
  regs.cp(mem.read8((regs.ix + 0x03) & 0xffff));
  m.step(0x230f, 19); // playerX vs objX
  regs.a = 0x01;
  m.step(0x2311, 7);
  if (regs.fC) {
    m.step(0x2314, 10);
    regs.a = regs.dec8(regs.a);
    m.step(0x2315, 4);
    regs.a = regs.dec8(regs.a);
    m.step(0x2316, 4); // A = 0xFF (-1)
  } else {
    m.step(0x2316, 10);
  }
  mem.write8((regs.ix + 0x10) & 0xffff, regs.a);
  m.step(0x2319, 19); // (ix+0x10) = dir
  m.ret(10);
}
