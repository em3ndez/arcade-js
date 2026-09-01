// SPDX-License-Identifier: GPL-3.0-only
// loc_0acf  (ROM 0x0acf-0x0ad6) -- seat HL=0x2b14, C=0x0f, then tail-jump into the
// block-copy helper at 0x0a93 (a routine head outside this band). Called from loc_0aea.
export function loc_0acf(m) {
  const { regs } = m;

  regs.hl = 0x2b14; m.step(0x0ad2, 10); // 0acf  lxi h,0x2b14
  regs.c = 0x0f; m.step(0x0ad4, 7); // 0ad2  mvi c,0x0f
  m.step(0x0a93, 10); return m.call(0x0a93); // 0ad4  jmp 0x0a93 (tail)
}
