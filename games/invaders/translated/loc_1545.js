// SPDX-License-Identifier: GPL-3.0-only
// loc_1545  (ROM 0x1545-0x1549) -- set prize state 0x2025 to 0x04, then fall through into loc_154a.
// Also entered by `jmp 0x1545` at 0x157e (the loc_1579 path).
export function loc_1545(m) {
  const { regs, mem } = m;

  regs.a = 0x04; m.step(0x1547, 7); // 1545  mvi a,0x04
  mem.write8(0x2025, regs.a); m.step(0x154a, 13); // 1547  sta 0x2025
  return m.call(0x154a); // fall through into loc_154a
}
