// SPDX-License-Identifier: GPL-3.0-only

// loc_5b71  (ROM 0x5b71-0x5b85) -- fire gate for one actor's IX record: only when it is in mode 5
// (ix+2), has its fire flag set (bit2 of ix+7), and its timer (ix+6) is still below 0x11 does it
// delegate the actual launch to loc_3a6c. Any guard failing returns without acting.
export function loc_5b71(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x5b74, 19);
  regs.cp(0x05);                                 m.step(0x5b76, 7);
  if (regs.fNZ) { m.ret(11); return; } // 5b76  ret nz -- not mode 5
  m.step(0x5b77, 5);

  regs.bit(2, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x5b7b, 20);
  if (regs.fZ) { m.ret(11); return; } // 5b7b  ret z -- fire flag clear
  m.step(0x5b7c, 5);

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x5b7f, 19);
  regs.cp(0x11);                                 m.step(0x5b81, 7);
  if (regs.fNC) { m.ret(11); return; } // 5b81  ret nc -- timer past 0x11
  m.step(0x5b82, 5);

  m.push16(0x5b85); m.step(0x3a6c, 17); m.call(0x3a6c); // 5b82  call 0x3a6c -- launch
  m.ret(); // 5b85  ret
}
