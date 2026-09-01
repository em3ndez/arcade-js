// SPDX-License-Identifier: GPL-3.0-only
// loc_190a  (ROM 0x190a-0x190f) -- call 0x14d8 then tail-jump into loc_1597 (delegate).
export function loc_190a(m) {
  m.push16(0x190d); m.step(0x14d8, 17); m.call(0x14d8); // 190a  call 0x14d8
  m.step(0x1597, 10); return m.call(0x1597); // 190d  jmp 0x1597
}
