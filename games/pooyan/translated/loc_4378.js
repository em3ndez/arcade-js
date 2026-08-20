// SPDX-License-Identifier: GPL-3.0-only

// loc_4378  (ROM 0x4378-0x4378) -- null handler: a lone `ret` (called stub, no effect).
export function loc_4378(m) {
  m.ret(10); // 4378  ret
}
