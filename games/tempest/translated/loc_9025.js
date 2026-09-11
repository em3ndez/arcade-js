// SPDX-License-Identifier: GPL-3.0-only
// loc_9025  (ROM 0x9025-0x902a) -- two subroutine calls (init 0x921b, then 0x92c5), then falls through into loc_902b.
export function loc_9025(m) {
  const { regs, mem } = m;
  m.push16(0x9027); m.step(0x9028, 6); m.call(0x921b);
  m.push16(0x902a); m.step(0x902b, 6); m.call(0x92c5);
  return m.call(0x902b);
}
