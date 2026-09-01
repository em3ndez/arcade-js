// SPDX-License-Identifier: GPL-3.0-only
// loc_166d  (ROM 0x166d-0x1670) -- reached by `jz 0x166d` at 0x02db. Zeroes A, calls 0x1a8b,
// then falls through into loc_1671 (its own head -- `jmp 0x1671` at 0x196e), so it delegates.
export function loc_166d(m) {
  m.regs.xor(m.regs.a); m.step(0x166e, 4); // 166d  xra a
  m.push16(0x1671); m.step(0x1a8b, 17); m.call(0x1a8b); // 166e  call 0x1a8b
  return m.call(0x1671); // 1671  fall through into loc_1671 (its own entry)
}
