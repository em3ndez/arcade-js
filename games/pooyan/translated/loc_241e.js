// SPDX-License-Identifier: GPL-3.0-only
//
// loc_241e  (ROM 0x241e-0x2435) -- per-frame driver for the 0x8a80 actor group, tail-jumped from
// 0x20ea. Runs three helpers (loc_2101, loc_25a6, loc_308b), aborts if the busy flag (0x881e) is
// set, then dispatches on (0x8a80+0x02)&7 via rst 0x28 into the inline table at 0x2436:
//   {0->0x2442, 1->0x2473, 2->0x2497, 3->0x24b9, 4->0x24db, 5->0x24fb}.
// The handler ret's to loc_241e's own caller. The 12 bytes at 0x2436-0x2441 are that table (data).
export function loc_241e(m) {
  const { regs, mem } = m;

  m.push16(0x2421); m.step(0x2101, 17); m.call(0x2101);
  m.push16(0x2424); m.step(0x25a6, 17); m.call(0x25a6);
  m.push16(0x2427); m.step(0x308b, 17); m.call(0x308b);
  regs.a = mem.read8(0x881e); m.step(0x242a, 13); // 2427  ld a,(0x881e)
  regs.and(regs.a); m.step(0x242b, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x242c, 5);
  regs.ix = 0x8a80; m.step(0x2430, 14);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x2433, 19); // 2430  ld a,(ix+2)
  regs.and(0x07); m.step(0x2435, 7);
  m.push16(0x2436); m.step(0x0028, 11); // 2435  rst 0x28 (table base 0x2436)
  return m.call(0x0028);
}
