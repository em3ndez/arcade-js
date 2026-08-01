// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_12de — on sub-state-timer expiry, tear down the finished sub-state's sprite
 *   scratch, advance GAME_SUBSTATE, and re-arm the timer to fire immediately.  ROM 0x12de.
 *
 * Reached as arm 2 of the BLINK_ANIM_PHASE (0x639D) rst-0x28 dispatch (entry_127f). It is polled every
 * frame, but gates itself on SUBSTATE_TIMER (0x6009) through the rst-0x18 helper
 * (tickSubstateTimer): while that counter is still counting down the dispatch is
 * abandoned this frame and nothing here runs. The one frame the counter EXPIRES it:
 *   1. clears the sprite scratch the finished sub-state is done with — loc_30db zeros
 *      the leading (X) byte of Mario's sprite record MARIO_SPRITE_RECORD (0x694C) and six
 *      shadow records (0x6958/5C/60/64/68/6C, unnamed slots inside SPRITE_BUFFER);
 *   2. advances GAME_SUBSTATE (0x600A) — by ONE normally, by TWO when ACTIVE_PLAYER_INDEX
 *      (0x600E) != 0 (the extra `inc (hl)`); and
 *   3. re-arms SUBSTATE_TIMER (0x6009) to 1, so the very next rst-0x18 poll expires at
 *      once and control passes straight on to the freshly-selected sub-state (contrast
 *      the sibling advanceSubstateAndArmTimer, which arms 0x40 to hold the new state).
 *
 * NAME KEPT NEUTRAL: the mechanical effect is clear, but ACTIVE_PLAYER_INDEX (0x600E, the
 * byte that gates the double-inc) reads 0 for the whole attract run, so the two-inc arm is
 * a dead path in every state the game actually produces — ram.js names the cell only on its
 * lockstep with CURRENT_PLAYER and flags this very 2P double-inc reader as unexercised in
 * attract. With no confirmer and that arm unresolved, an English name for THIS ROUTINE is
 * not yet earned (docs/decompiler-pipeline: a wrong routine name misleads worse than a
 * neutral loc_ one); left as loc_12de.
 *
 * Bottom-up: both callees are already idiomatic and called directly —
 *   - tickSubstateTimer (rst 0x18, ROM 0x0018): the gate. Returns true on expiry (run
 *     the remainder), false while counting (skip) — the boolean that replaces the Z80
 *     caller-skip stack surgery.
 *   - loc_30db (ROM 0x30db): the seven-byte sprite-scratch clear.
 *
 * Memory-equivalent to the frozen oracle — equivalence-12de.test.js.
 * GATE:     crafted-entry — real captured 0x12de dispatches from an attract run cover
 *           both the non-expiry (timer decrement only) and the 1-player expiry arm;
 *           crafted entries force the timer, sentinel the sprite page to pin the clear
 *           footprint, and set 0x600E != 0 for the 2-player double-inc arm attract
 *           never reaches. Teeth: wrong-timer-arm, single-inc-ignores-2P, skip-clear.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), and the
 *           seven sprite-scratch bytes loc_30db zeros. The oracle's SP/pc churn is the
 *           dropped Z80 stack model (push16/rst/call/ret land only in STACK_SCRATCH,
 *           excluded from the contract); its residual A/HL/F are dead ABI (this returns
 *           into the rst-0x28 dispatch, which reads none before overwriting them).
 * NAMES:    GAME_SUBSTATE (0x600A), SUBSTATE_TIMER (0x6009), ACTIVE_PLAYER_INDEX (0x600E,
 *           the 1P/2P index gating the double-inc) — ram.js.
 *           Callees: tickSubstateTimer (ROM 0x0018), loc_30db (ROM 0x30db).
 */

import { GAME_SUBSTATE, SUBSTATE_TIMER, ACTIVE_PLAYER_INDEX } from "./ram.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loc_30db } from "./loc_30db.js";

export function loc_12de(m) {
  const { mem } = m;

  // rst 0x18: tick SUBSTATE_TIMER. Not expired -> the dispatch is abandoned this frame.
  if (!tickSubstateTimer(m)) return;

  // call 0x30db: clear the sprite scratch the finished sub-state is done with.
  loc_30db(m);

  // Advance GAME_SUBSTATE: +1 for a 1-player game, +2 when ACTIVE_PLAYER_INDEX != 0 (the
  // extra `inc (hl)`). Two 8-bit `inc (hl)` in a row equal one (+2 mod 256), so a single
  // wrapping add reproduces the oracle's value for both arms.
  const extra = mem.read8(ACTIVE_PLAYER_INDEX) !== 0 ? 1 : 0;
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1 + extra) & 0xff);

  // Re-arm SUBSTATE_TIMER to 1 so the next rst-0x18 poll expires immediately.
  mem.write8(SUBSTATE_TIMER, 0x01);
}
