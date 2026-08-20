// SPDX-License-Identifier: GPL-3.0-only

// loc_2101  (ROM 0x2101-0x210a) -- boot-frontier sub-dispatch: runs 0x2778, 0x210b, 0x2157 in
// sequence, then returns. All three are plain calls (each pushes its own return address).
export function loc_2101(m) {
  m.push16(0x2104); m.step(0x2778, 17); m.call(0x2778);
  m.push16(0x2107); m.step(0x210b, 17); m.call(0x210b);
  m.push16(0x210a); m.step(0x2157, 17); m.call(0x2157);

  m.ret(10); // 210a  ret
}
