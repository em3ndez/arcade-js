// SPDX-License-Identifier: GPL-3.0-only
// loc_3ff6  (ROM 0x3ff6-0x3ff9) -- JMP $3ff6: a jump to itself (a spin-to-self halt trap).
export function loc_3ff6(m) {
  m.step(0x3ff6, 3); return m.call(0x3ff6); // 3ff6 jmp $3ff6
}
