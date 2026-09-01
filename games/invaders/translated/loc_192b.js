// SPDX-License-Identifier: GPL-3.0-only
// loc_192b  (ROM 0x192b-0x1930) -- seat HL=0x20fc and tail-jump into the shared unpack+draw
// at loc_1931 -- delegate.
export function loc_192b(m) {
  const { regs } = m;

  regs.hl = 0x20fc; m.step(0x192e, 10); // 192b  lxi h,0x20fc
  m.step(0x1931, 10); return m.call(0x1931); // 192e  jmp 0x1931
}
