// SPDX-License-Identifier: GPL-3.0-only
// loc_0bf1  (ROM 0x0bf1-0x0bf6) -- call 0x190a, then tail-jump into 0x199a (both routine
// heads outside this band). Called from loc_0aea's inner loop (0x0b74).
export function loc_0bf1(m) {
  m.push16(0x0bf4); m.step(0x190a, 17); m.call(0x190a); // 0bf1  call 0x190a
  m.step(0x199a, 10); return m.call(0x199a); // 0bf4  jmp 0x199a (tail)
}
