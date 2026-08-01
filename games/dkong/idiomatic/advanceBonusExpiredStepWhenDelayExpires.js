// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBonusExpiredStepWhenDelayExpires — the DELAY step of the bonus-expired
 * sequence: hold, then advance once a countdown elapses.  ROM 0x1a1f.
 *
 * BONUS_EXPIRED_STEP (0x6386) is a small 0..3 state machine dispatched every frame
 * by the rst-0x28 router at ROM 0x1A07 (entry_1a07), fired when the board's BONUS
 * hits 0. This is its state-2 handler. Each frame it decrements BONUS_EXPIRED_DELAY
 * (0x6387) in place; while the delay is still non-zero the sequence stays parked in
 * state 2, and only when the delay reaches 0 does it advance BONUS_EXPIRED_STEP to 3.
 * (The prior step, loc_1a15, cleared the delay to 0 on entry, so `dec` first wraps it
 * to 0xFF — the wait is a full 256-frame roll before the underflow to 0.)
 *
 * A LEAF: reads and writes only BONUS_EXPIRED_DELAY, and on expiry writes the constant
 * 3 to BONUS_EXPIRED_STEP. Calls nothing. It returns nothing its dispatcher consumes —
 * entry_1a07's idx2 arm returns a constant true regardless of this handler, and control
 * lands back in loc_197a (the rst-0x28 dispatches by jump, so the handler's `ret` goes
 * straight to loc_197a), which reads no register this leaves behind.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a1f.test.js.
 * GATE:     exhaustive — a total function of the one byte BONUS_EXPIRED_DELAY (0x6387);
 *           candidate == oracle on RAM (minus STACK_SCRATCH) over all 256 values, plus
 *           crafted state-2 entries carved from real captured 0x1A07 dispatches. NOT
 *           reached naturally in attract (BONUS never expires there — entry_1a07 fires
 *           916×/1500 frames, always at step 0), so state 2 is forced identically on
 *           both sides.
 * LIVE-OUT: memory-only — BONUS_EXPIRED_DELAY decremented, and BONUS_EXPIRED_STEP set
 *           to 3 on the underflow frame. No live registers/flags (the oracle's residual
 *           A/HL/F are dead ABI; SP/PC are the Z80 return mechanism, not the contract).
 * NAMES:    BONUS_EXPIRED_DELAY (0x6387), BONUS_EXPIRED_STEP (0x6386) — from ram.js.
 */

import { BONUS_EXPIRED_DELAY, BONUS_EXPIRED_STEP } from "./ram.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 */
export function advanceBonusExpiredStepWhenDelayExpires(m) {
  const { mem } = m;

  // dec (0x6387) — tick the delay down one frame.
  const remaining = (mem.read8(BONUS_EXPIRED_DELAY) - 1) & 0xff;
  mem.write8(BONUS_EXPIRED_DELAY, remaining);

  // ret nz — while the delay is still counting, stay parked in state 2.
  if (remaining !== 0) return;

  // The delay elapsed — advance the bonus-expired sequence to step 3.
  mem.write8(BONUS_EXPIRED_STEP, 0x03);
}
