// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickDispatcherCountdown — tick sub_1dbd's state-2 hold timer; reset the dispatcher on expiry.  ROM 0x1E4A.
 *
 * sub_1dbd (ROM 0x1DBD) is a 4-entry rst-0x28 router on EFFECT_STATE (0x6340):
 * 0 = idle, 1 = arm-timer, 2 = this countdown, 3 = reset. This is the
 * state-2 arm. State 1 (armScorePopupAndSelectAward) arms EFFECT_TIMER (0x6341) to 0x40 and advances
 * the dispatcher 1 -> 2; state 2 then runs here once per frame:
 *
 *   - decrement EFFECT_TIMER (0x6341) in place, and
 *   - while it is still non-zero, do nothing else (stay in state 2), or
 *   - on the frame it reaches 0, end the hold: clear POPUP_SPRITE (0x6a30)
 *     and reset EFFECT_STATE (0x6340) := 0, dropping sub_1dbd back to its idle arm.
 *
 * So a full hold is exactly 0x40 = 64 dispatches — 63 still-counting frames then one
 * expiry (measured: fires 64x in a plain attract run, frames ~1138..1201).
 *
 * A LEAF: reads and writes only these three RAM bytes, calls nothing. The oracle's
 * `ret nz` / `ret` are BOTH plain returns to sub_1dbd's caller (loc_197a) — there is
 * no caller-skip idiom here — so this routine returns void; control flow is the JS
 * return, not a boolean.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e4a.test.js.
 * GATE:     exhaustive — a total function of the 0x6341 countdown byte; compared to
 *           the oracle on RAM over all 256 values (both arms: 255 still-counting +
 *           the single expiry at 0x6341 == 1), plus real captured attract dispatches
 *           that naturally cover both arms. Reached only via sub_1dbd state 2.
 * LIVE-OUT: memory-only — EFFECT_TIMER (0x6341) always decremented; on expiry
 *           POPUP_SPRITE (0x6a30) := 0 and EFFECT_STATE (0x6340) := 0. The oracle's
 *           `ret` (SP += 2, PC := return addr) is the normal return the JS return
 *           replaces, so SP/PC are not in the contract; its residual A/F are dead ABI
 *           (loc_197a's next op after this returns is `call 0x1e8c`, which reads neither).
 * NAMES:    EFFECT_STATE (0x6340), EFFECT_TIMER (0x6341), POPUP_SPRITE (0x6a30) from
 *           names.js — all three landed in the ABC/DE naming pass (this is sub_1dbd's
 *           effect state machine: EFFECT_STATE router, EFFECT_TIMER the state-2 hold
 *           countdown, POPUP_SPRITE the score-popup record blanked on expiry).
 */

import { EFFECT_STATE, EFFECT_TIMER, POPUP_SPRITE } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function tickDispatcherCountdown(m) {
  const { mem } = m;

  // dec (hl) at EFFECT_TIMER (0x6341) — decrement the state-2 countdown in place.
  const remaining = (mem.read8(EFFECT_TIMER) - 1) & 0xff;
  mem.write8(EFFECT_TIMER, remaining);

  // ret nz — still counting: stay in state 2, nothing else to do.
  if (remaining !== 0) return;

  // Timer expired (xor a / ld (0x6a30),a / ld (0x6340),a): end the hold — clear
  // POPUP_SPRITE and reset EFFECT_STATE to its idle arm (state 0).
  mem.write8(POPUP_SPRITE, 0);
  mem.write8(EFFECT_STATE, 0);
}
