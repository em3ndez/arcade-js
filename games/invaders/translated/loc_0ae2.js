// SPDX-License-Identifier: GPL-3.0-only
// loc_0ae2  (ROM 0x0ae2-0x0ae9) -- seat HL=0x20c2, B=0x0c, then tail-jump into the
// helper at 0x1a32 (a routine head outside this band). Called from loc_0aea / loc_0b89.
export function loc_0ae2(m) {
  const { regs } = m;

  regs.hl = 0x20c2; m.step(0x0ae5, 10); // 0ae2  lxi h,0x20c2
  regs.b = 0x0c; m.step(0x0ae7, 7); // 0ae5  mvi b,0x0c
  m.step(0x1a32, 10); return m.call(0x1a32); // 0ae7  jmp 0x1a32 (tail)
}
