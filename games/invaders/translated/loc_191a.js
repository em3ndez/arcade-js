// SPDX-License-Identifier: GPL-3.0-only
// loc_191a  (ROM 0x191a-0x1924) -- seat C=0x1c, HL=0x241e, DE=0x1ae4, then tail-jump into
// loc_08f3 (a copy/clear helper) -- delegate.
export function loc_191a(m) {
  const { regs } = m;

  regs.c = 0x1c; m.step(0x191c, 7); // 191a  mvi c,0x1c
  regs.hl = 0x241e; m.step(0x191f, 10); // 191c  lxi h,0x241e
  regs.de = 0x1ae4; m.step(0x1922, 10); // 191f  lxi d,0x1ae4
  m.step(0x08f3, 10); return m.call(0x08f3); // 1922  jmp 0x08f3
}
