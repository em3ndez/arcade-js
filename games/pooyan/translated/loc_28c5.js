// SPDX-License-Identifier: GPL-3.0-only
//
// loc_28c5  (ROM 0x28c5-0x28c5) -- 0x8f30 state 4 (dispatch 0x277e[4]): the idle state, a bare ret.
// Also the return landing of loc_28ad's rst 0x10.
export function loc_28c5(m) {
  m.ret(); // 28c5  ret
}
