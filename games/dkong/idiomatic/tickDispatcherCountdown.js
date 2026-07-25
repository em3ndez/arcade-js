// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickDispatcherCountdown — tick sub_1dbd's state-2 hold timer; reset the dispatcher on expiry.  ROM 0x1E4A.
 *
 * sub_1dbd (ROM 0x1DBD) is a 4-entry rst-0x28 router on a dispatcher-state byte
 * (0x6340): 0 = idle, 1 = arm-timer, 2 = this countdown, 3 = reset. This is the
 * state-2 arm. State 1 (loc_1dc9) arms a countdown byte (0x6341) to 0x40 and advances
 * the dispatcher 1 -> 2; state 2 then runs here once per frame:
 *
 *   - decrement the countdown byte (0x6341) in place, and
 *   - while it is still non-zero, do nothing else (stay in state 2), or
 *   - on the frame it reaches 0, end the hold: clear the popup param byte (0x6a30)
 *     and reset the dispatcher (0x6340) := 0, dropping sub_1dbd back to its idle arm.
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
 * LIVE-OUT: memory-only — mem[0x6341] always decremented; on expiry mem[0x6a30] := 0
 *           and mem[0x6340] := 0. The oracle's `ret` (SP += 2, PC := return addr) is
 *           the normal return the JS return replaces, so SP/PC are not in the contract;
 *           its residual A/F are dead ABI (loc_197a's next op after this returns is
 *           `call 0x1e8c`, which reads neither).
 * NAMES:    none in ram.js — 0x6340/0x6341/0x6a30 kept hex (dispatcher state / state-2
 *           countdown / popup param byte); control-proven candidates, not landed in ram.js.
 */

const COUNTDOWN = 0x6341; // sub_1dbd state-2 countdown, armed to 0x40 by state 1 (loc_1dc9)
const DISPATCH_STATE = 0x6340; // sub_1dbd rst-28 router index; reset to 0 (idle) on expiry
const POPUP_PARAM = 0x6a30; // param-block byte written by loc_1e28/loc_1e36; cleared on expiry

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function tickDispatcherCountdown(m) {
  const { mem } = m;

  // dec (hl) at 0x6341 — decrement the state-2 countdown in place.
  const remaining = (mem.read8(COUNTDOWN) - 1) & 0xff;
  mem.write8(COUNTDOWN, remaining);

  // ret nz — still counting: stay in state 2, nothing else to do.
  if (remaining !== 0) return;

  // Timer expired (xor a / ld (0x6a30),a / ld (0x6340),a): end the hold — clear the
  // popup param byte and reset the dispatcher to its idle arm (state 0).
  mem.write8(POPUP_PARAM, 0);
  mem.write8(DISPATCH_STATE, 0);
}
