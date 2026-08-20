// SPDX-License-Identifier: GPL-3.0-only

// loc_4179  (ROM 0x4179) -- one-byte null handler: `ret`. An m.call target that just returns
// without doing any work; ends exactly at the 0x417a boundary (loc_417a).
export function loc_4179(m) {
  m.ret(); // 4179  ret
}
