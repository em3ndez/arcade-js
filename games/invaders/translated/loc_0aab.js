// SPDX-License-Identifier: GPL-3.0-only
// loc_0aab  (ROM 0x0aab-0x0ab0) -- load HL=0x2050 and tail-jump into 0x024b (delegate, not inline).
// Reached from loc_0abf's `jc 0x0aab` (bit-2 dispatch).
export function loc_0aab(m) {
  const { regs } = m;

  regs.hl = 0x2050; m.step(0x0aae, 10);  // 0aab lxi h,0x2050
  m.step(0x024b, 10); return m.call(0x024b); // 0aae jmp 0x024b
}
