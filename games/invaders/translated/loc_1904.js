// SPDX-License-Identifier: GPL-3.0-only
// loc_1904  (ROM 0x1904-0x1909) -- seat HL=0x2200 (video RAM base) and tail-jump into
// loc_01c3 (delegate, do not inline across the boundary).
export function loc_1904(m) {
  const { regs } = m;

  regs.hl = 0x2200; m.step(0x1907, 10); // 1904  lxi h,0x2200
  m.step(0x01c3, 10); return m.call(0x01c3); // 1907  jmp 0x01c3
}
