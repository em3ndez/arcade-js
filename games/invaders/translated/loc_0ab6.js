// SPDX-License-Identifier: GPL-3.0-only
// loc_0ab6  (ROM 0x0ab6-0x0aba) -- set A=0x80 and tail-jump into 0x0ad7 (write A to timer 0x20c0
// and wait). Delegate, not inline.
export function loc_0ab6(m) {
  const { regs } = m;

  regs.a = 0x80; m.step(0x0ab8, 7);       // 0ab6 mvi a,0x80
  m.step(0x0ad7, 10); return m.call(0x0ad7); // 0ab8 jmp 0x0ad7
}
