// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_66F5 = "0x66f5 ((ix+2) record state, 0x8ae0 bird table): 0..3 = 66fd 672a 67a0 67df";

// loc_66f1  (ROM 0x66f1-0x66fc) -- 0x8ae0 bird-record state dispatcher. Reads state (ix+2) and
// rst 0x28 tail-dispatches through the inline 4-word table at 0x66f5; the selected handler ret's
// straight to loc_66f1's caller (pure tail dispatch, no handler-return pushed first).
export function loc_66f1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x66f4, 19); // 66f1  ld a,(ix+0x02)
  m.push16(0x66f5);
  m.step(0x0028, 11); // 66f4  rst 0x28 -- pushes inline table base 0x66f5
  return m.call(0x0028, DISPATCH_TABLE_66F5);
}
