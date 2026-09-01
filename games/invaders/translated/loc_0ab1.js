// SPDX-License-Identifier: GPL-3.0-only
// loc_0ab1  (ROM 0x0ab1-0x0ab5) -- set A=0x40 and tail-jump into 0x0ad7 (write A to timer 0x20c0
// and wait). Delegate, not inline.
export function loc_0ab1(m) {
  const { regs } = m;

  regs.a = 0x40; m.step(0x0ab3, 7);       // 0ab1 mvi a,0x40
  m.step(0x0ad7, 10); return m.call(0x0ad7); // 0ab3 jmp 0x0ad7
}
