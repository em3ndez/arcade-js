// SPDX-License-Identifier: GPL-3.0-only
// loc_193c  (ROM 0x193c-0x1946) -- seat C=0x07, HL=0x3501, DE=0x1fa9, then tail-jump into the
// copy/clear helper loc_08f3 -- delegate.
export function loc_193c(m) {
  const { regs } = m;

  regs.c = 0x07; m.step(0x193e, 7); // 193c  mvi c,0x07
  regs.hl = 0x3501; m.step(0x1941, 10); // 193e  lxi h,0x3501
  regs.de = 0x1fa9; m.step(0x1944, 10); // 1941  lxi d,0x1fa9
  m.step(0x08f3, 10); return m.call(0x08f3); // 1944  jmp 0x08f3
}
