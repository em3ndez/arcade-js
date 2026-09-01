// SPDX-License-Identifier: GPL-3.0-only
// loc_1950  (ROM 0x1950-0x1955) -- seat HL=0x20f4 and tail-jump into the shared unpack+draw
// at loc_1931 -- delegate.
export function loc_1950(m) {
  const { regs } = m;

  regs.hl = 0x20f4; m.step(0x1953, 10); // 1950  lxi h,0x20f4
  m.step(0x1931, 10); return m.call(0x1931); // 1953  jmp 0x1931
}
