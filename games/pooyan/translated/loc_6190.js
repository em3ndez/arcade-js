// SPDX-License-Identifier: GPL-3.0-only

// loc_6190  (ROM 0x6190-0x6199) -- seat (ix+0x08)=0x01 and (ix+0x0a)=0xd0 on the matched target
// record, then tail-jump loc_6166 (reset the actor record). Leaf writes, no calls.
export function loc_6190(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x08) & 0xffff, 0x01);   m.step(0x6194, 19);
  mem.write8((regs.ix + 0x0a) & 0xffff, 0xd0);   m.step(0x6198, 19);
  m.step(0x6166, 12);                            // 6198  jr 0x6166 (tail)
  return m.call(0x6166);
}
