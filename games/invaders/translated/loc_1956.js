// SPDX-License-Identifier: GPL-3.0-only
// loc_1956  (ROM 0x1956-0x196a) -- init/redraw batch: calls 0x1a5c then the descriptor draws
// 0x191a/0x1925/0x192b/0x1950/0x193c, and tail-jumps into loc_1947 -- delegate.
export function loc_1956(m) {
  m.push16(0x1959); m.step(0x1a5c, 17); m.call(0x1a5c); // 1956  call 0x1a5c
  m.push16(0x195c); m.step(0x191a, 17); m.call(0x191a); // 1959  call 0x191a
  m.push16(0x195f); m.step(0x1925, 17); m.call(0x1925); // 195c  call 0x1925
  m.push16(0x1962); m.step(0x192b, 17); m.call(0x192b); // 195f  call 0x192b
  m.push16(0x1965); m.step(0x1950, 17); m.call(0x1950); // 1962  call 0x1950
  m.push16(0x1968); m.step(0x193c, 17); m.call(0x193c); // 1965  call 0x193c
  m.step(0x1947, 10); return m.call(0x1947); // 1968  jmp 0x1947
}
