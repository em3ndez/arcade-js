// SPDX-License-Identifier: GPL-3.0-only
// loc_3046 (ROM 0x3046-0x3049) -- calls the $2B79 subroutine, then runs on into the routine at 0x3049.
export function loc_3046(m) {
  const { regs, mem } = m;
  m.step(0x3049, 6); m.call(0x2b79); // 3046 jsr $2b79
  return m.call(0x3049);             // fall through to the next routine
}
