// SPDX-License-Identifier: GPL-3.0-only
/**
 * startBonusExpiredDelay — arm the DELAY phase of the bonus-expired death sequence.  ROM 0x1A15.
 *
 * BONUS_EXPIRED_STEP (0x6386) is a tiny four-state machine that the per-frame gameplay
 * cascade loc_197a runs every frame via `ld a,(0x6386) / rst 0x28` at ROM 0x1A07
 * (entry_1a07). Both bonus-decrement sites set it to 1 the moment the on-screen BONUS
 * reaches 0, arming the "bonus expired → kill the player" sequence:
 *
 *   state 0  idx0  no-op `ret` (0x1A1E)              BONUS still > 0 — do nothing
 *   state 1  idx1  THIS routine                      INIT: clear the delay, go to state 2
 *   state 2  idx2  loc_1a1f (DELAY)                   count 0x6387 down; at 0 → state 3
 *   state 3  idx3  loc_1a2a (WAIT+EXIT)               once airborne flag (0x6216)==0, take
 *                                                     the death exit
 *
 * As idx1, this routine is the one-shot INIT. It does exactly two constant stores and
 * reads nothing:
 *
 *   - clears the delay counter BONUS_EXPIRED_DELAY (0x6387) to 0. State 2 (loc_1a1f) then
 *     does `dec (0x6387) / ret nz`, so the first decrement wraps 0 → 0xFF — a 256-frame
 *     delay — before it advances the machine to state 3.
 *   - advances BONUS_EXPIRED_STEP (0x6386) from 1 (INIT) to 2 (DELAY).
 *
 * Both targets are plain work RAM with no cross-dependency, so the store order is
 * immaterial. The routine calls nothing: after its two stores the oracle falls straight
 * into the shared 0x1A1E `ret` (the state machine's idx0 "no-op ret") back into loc_197a.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a15.test.js.
 * GATE:     crafted-entry — the routine READS no input and writes two constants, so its
 *           whole behaviour is exercised by any single entry; validated across many real
 *           full-RAM backgrounds (captured at the 0x1A07 dispatcher, which fires every
 *           gameplay frame) with 0x6386/0x6387 seeded to sentinels so both writes are
 *           observable, compared vs the oracle on RAM − STACK_SCRATCH; teeth per write.
 *           Never dispatched in attract (BONUS never reaches 0 — 0/2500 frames); reached
 *           in a credited game only when the bonus expires and the sequence is at state 1.
 * LIVE-OUT: memory-only — writes BONUS_EXPIRED_DELAY (0x6387) := 0 and BONUS_EXPIRED_STEP
 *           (0x6386) := 2. entry_1a07 discards this handler's return, and loc_197a's very
 *           next act after the 0x1A07 call is another `call` (0x2FCB) that overwrites A and
 *           the flags — so the oracle's residual A=2 / `xor a` flags are dead ABI. SP/pc are
 *           the Z80 `ret` the direct-call return replaces and are not modelled.
 * NAMES:    BONUS_EXPIRED_STEP (0x6386), BONUS_EXPIRED_DELAY (0x6387) from ram.js — both
 *           imported; no hex-kept addresses.
 */

import { BONUS_EXPIRED_STEP, BONUS_EXPIRED_DELAY } from "../optimized/ram.js";

export function startBonusExpiredDelay(m) {
  const { mem } = m;

  // Clear the delay counter; state 2 (loc_1a1f) counts it down, its first `dec` wrapping
  // 0 → 0xFF for a full 256-frame delay before the sequence advances.
  mem.write8(BONUS_EXPIRED_DELAY, 0);

  // Advance the bonus-expired state machine from INIT (1) to DELAY (2).
  mem.write8(BONUS_EXPIRED_STEP, 2);
}
