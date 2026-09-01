// SPDX-License-Identifier: GPL-3.0-only
// loc_1a8b  (ROM 0x1a8b-0x1a92) -- seat HL=0x2501, mask A to its low nibble, then tail-jump to
// loc_09c5 (delegate). Also reached by fall-through from loc_1a7f.
export function loc_1a8b(m) {
  const { regs } = m;

  regs.hl = 0x2501; m.step(0x1a8e, 10); // 1a8b  lxi h,0x2501
  regs.and(0x0f); m.step(0x1a90, 7); // 1a8e  ani 0x0f
  m.step(0x09c5, 10); return m.call(0x09c5); // 1a90  jmp 0x09c5
}
