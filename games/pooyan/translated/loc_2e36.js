// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2e36  (ROM 0x2e36-0x2e3c) -- per-rope-cell dispatcher for loc_2e22. Returns if the cell state
// (ix+0x00) is zero; otherwise dispatches (ix+0x00)-1 via rst 0x28 into the inline table at 0x2e3d
// {0->0x2e5e, 1->0x2ecb, 2->0x2f01, 3->0x2f2f}. The handler ret's to loc_2e22.
export function loc_2e36(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x2e39, 19); // 2e36  ld a,(ix+0)
  regs.sub(0x01); m.step(0x2e3b, 7); // 2e39  sub 0x01
  if (regs.fC) { m.ret(11); return; } // 2e3b  ret c (inactive cell)
  m.step(0x2e3c, 5);
  m.push16(0x2e3d); m.step(0x0028, 11); // 2e3c  rst 0x28 (table base 0x2e3d)
  return m.call(0x0028);
}
