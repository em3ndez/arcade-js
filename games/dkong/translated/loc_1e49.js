// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e49  (ROM 0x1E49–0x1E49) — sub_1dbd rst-28 table[0] (0x6340==0): the state-0 IDLE arm. ROM 0x1E49.
 * A 1-byte `ret` no-op. Reached by rst-28 jump-dispatch, so this ret returns to
 * sub_1dbd's caller (loc_197a @0x197D).
 * TAPE-HOT -- the FIRE-1 blocker (A=mem[0x6340]=0 on the coin/start tape).
 */
export function loc_1e49(m) {
  m.ret(10); // 0x1E49  c9  ret
}
