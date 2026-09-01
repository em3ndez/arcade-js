// SPDX-License-Identifier: GPL-3.0-only
// loc_1979  (ROM 0x1979-0x1981) -- calls 0x19d7 then 0x1947, then tail-jumps to loc_193c.
export function loc_1979(m) {
  m.push16(0x197c); m.step(0x19d7, 17); m.call(0x19d7); // 1979  call 0x19d7
  m.push16(0x197f); m.step(0x1947, 17); m.call(0x1947); // 197c  call 0x1947
  m.step(0x193c, 10); return m.call(0x193c);            // 197f  jmp 0x193c
}
