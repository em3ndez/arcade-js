// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_64FF = "0x64ff ((ix+2) record state, 0x8c78 fountain): 0..2 = 6505 6566 6666";

// loc_64fb  (ROM 0x64fb-0x6504) -- 0x8c78 fountain-record state dispatcher. Reads state (ix+2) and
// rst 0x28 tail-dispatches through the inline 3-word table at 0x64ff; the selected handler ret's
// straight to loc_64fb's caller (pure tail dispatch, no handler-return pushed first).
export function loc_64fb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x64fe, 19); // 64fb  ld a,(ix+0x02)
  m.push16(0x64ff);
  m.step(0x0028, 11); // 64fe  rst 0x28 -- pushes inline table base 0x64ff
  return m.call(0x0028, DISPATCH_TABLE_64FF);
}
