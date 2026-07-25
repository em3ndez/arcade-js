// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1a1e  (ROM 0x1A1E–0x1A1E) — NO-OP dispatch handler. ROM 0x1A1E (1 byte).
 * A `dw 0x1a1e` slot in the 0x1A0A rst 0x28 table: this state does nothing.
 * rst 0x28 dispatches by jp, so this `ret` returns to the 0x1A0A routine's
 * CALLER (no frame of its own was pushed).
 *   1a1e  c9  ret
 */
export function sub_1a1e(m) {
  m.ret(10);
}
