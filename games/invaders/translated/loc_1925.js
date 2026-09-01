// SPDX-License-Identifier: GPL-3.0-only
// loc_1925  (ROM 0x1925-0x192a) -- seat HL=0x20f8 (a sprite-descriptor pointer) and tail-jump
// into the shared unpack+draw at loc_1931 -- delegate.
export function loc_1925(m) {
  const { regs } = m;

  regs.hl = 0x20f8; m.step(0x1928, 10); // 1925  lxi h,0x20f8
  m.step(0x1931, 10); return m.call(0x1931); // 1928  jmp 0x1931
}
