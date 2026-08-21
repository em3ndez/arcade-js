// SPDX-License-Identifier: GPL-3.0-only

// loc_64e2  (ROM 0x64e2-0x64fa) -- fountain/spawn subtree driver: seeds loc_6b13, dispatches the
// 0x8c78 record via loc_64fb, then runs the 0x8ae0 bird pass (loc_66c5, IX=0x8ae0/IY=0x8c78) and
// loc_6822 before returning. Straight-line calls, no branches.
export function loc_64e2(m) {
  const { regs } = m;

  m.push16(0x64e5); m.step(0x6b13, 17); m.call(0x6b13);
  regs.ix = 0x8c78;                     m.step(0x64e9, 14);
  m.push16(0x64ec); m.step(0x64fb, 17); m.call(0x64fb);
  regs.ix = 0x8ae0;                     m.step(0x64f0, 14);
  regs.iy = 0x8c78;                     m.step(0x64f4, 14);
  m.push16(0x64f7); m.step(0x66c5, 17); m.call(0x66c5);
  m.push16(0x64fa); m.step(0x6822, 17); m.call(0x6822);
  return m.ret(10);
}
