// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e94  (ROM 0x1E94–0x1E95) — entry_1e8c's private skip tail.
 *
 *   1e94  e1           pop  hl           ; discard the caller's return address
 *   1e95  c9           ret               ; return to the caller's CALLER
 *
 * SINGLE CALLER-SKIP (sub_0020-tail / sub_0044 idiom): `pop hl` drops one stack
 * frame (the 0x197D caller's 0x1980), then `ret` returns to the caller's caller.
 * NOT a plain return. Reached only by fall-through from entry_1e8c's non-zero
 * path (blocked above until 0x1E96 lands); standalone here for direct testing.
 */
export function loc_1e94(m) {
  const { regs } = m;

  regs.hl = m.pop16(); // pop hl -- discards the caller's return address
  m.step(0x1e95, 10);
  m.ret(); // ret -- returns to the caller's CALLER (single-frame skip)
}
