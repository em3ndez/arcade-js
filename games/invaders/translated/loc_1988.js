// SPDX-License-Identifier: GPL-3.0-only
// loc_1988  (ROM 0x1988-0x198a) -- unconditional tail-jump to loc_09d6.
export function loc_1988(m) {
  m.step(0x09d6, 10); return m.call(0x09d6); // 1988  jmp 0x09d6
}
