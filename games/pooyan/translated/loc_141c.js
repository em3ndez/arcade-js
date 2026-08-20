// SPDX-License-Identifier: GPL-3.0-only

// loc_141c  (ROM 0x141c-0x1429) -- gate on (ix+6): if >= 2, return; else clear (ix+8), seat DE=0x3829
// and tail-jump to loc_381e (spawn/queue helper). Also the fall-through target of loc_1410.
export function loc_141c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x141f, 19);
  regs.cp(0x02);                                 m.step(0x1421, 7);
  if (regs.fNC) { m.ret(11); return; }           // ret nc -- (ix+6) >= 2
  m.step(0x1422, 5);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x00);   m.step(0x1426, 19);
  regs.de = 0x3829;                              m.step(0x1429, 10);
  m.step(0x381e, 10);                            // jp 0x381e (tail)
  return m.call(0x381e);
}
