// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_271e  (ROM 0x271E–0x2721) — thin wrapper: call sub_2745, ret.
 */
export function sub_271e(m) {
  m.push16(0x2721); m.step(0x2745, 17); m.call(0x2745);
  m.ret(10);
}
