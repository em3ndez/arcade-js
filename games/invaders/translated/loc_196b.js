// SPDX-License-Identifier: GPL-3.0-only
// loc_196b  (ROM 0x196b-0x1970) -- call 0x19dc then tail-jump into loc_1671 (delegate).
export function loc_196b(m) {
  m.push16(0x196e); m.step(0x19dc, 17); m.call(0x19dc); // 196b  call 0x19dc
  m.step(0x1671, 10); return m.call(0x1671); // 196e  jmp 0x1671
}
