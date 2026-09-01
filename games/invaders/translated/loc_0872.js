// SPDX-License-Identifier: GPL-3.0-only
// loc_0872  (ROM 0x0872-0x0877) -- reached by loc_0804's `jc 0x0872`. Calls 0x021a then tail-jumps
// into loc_0814.
export function loc_0872(m) {
  m.push16(0x0875); m.step(0x021a, 17); m.call(0x021a); // 0872  call 0x021a
  m.step(0x0814, 10); return m.call(0x0814); // 0875  jmp 0x0814 (tail)
}
