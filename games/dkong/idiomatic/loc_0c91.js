// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0c91 — gated board (re)build: tick the sub-state countdown and build the board
 * only on the frame the countdown expires.  ROM 0x0C91.
 *
 * The in-play entry to the board builder: the 0x0702 sub-state table's index-10 arm,
 * dispatched under the vblank service while the game sub-state is the board-setup value.
 * Every frame it counts the sub-state timer down by one; while that timer is still above
 * zero it does nothing this frame, and only on the tick that brings it to zero does it run
 * the full board build. Polarity matters: the build fires on EXPIRY, not while counting —
 * reading the gate the other way inverts the whole routine.
 *
 * (The board builder also has a second, ungated entry — handler_0763's tail jump — used
 * for the timed state-1 advance into the 25m board; this one is the countdown-gated entry.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-0c91.test.js.
 * GATE:     crafted-entry — the in-play rebuild is not reached in a plain attract run, so
 *           each board's real entry is forced by an identical-both-sides board poke
 *           (GAME_STATE=3, GAME_SUBSTATE=0x0A, SUBSTATE_TIMER=1, BOARD=1..4) that dispatches
 *           loc_0c91 once under the vblank service; the skip path is a crafted timer>1 (and
 *           the timer==0 wrap-past-zero) on those same entries. Compared on RAM −
 *           STACK_SCRATCH PLUS the palette-bank output latch buildBoard drives on expiry.
 *           Teeth: an inverted gate (builds while still counting) and a dropped countdown tick.
 * LIVE-OUT: memory-only — the ticked sub-state timer and, on expiry, everything buildBoard
 *           writes — PLUS the palette-bank latch (an I/O device register the display reads,
 *           not part of the RAM dump). The caller consumes no return value; the oracle's
 *           push16/rst/ret churn is the dropped stack model (its bytes fall in STACK_SCRATCH).
 * NAMES:    none touched directly by this routine. Callees tickSubstateTimer (ROM 0x0018,
 *           ticks SUBSTATE_TIMER 0x6009) and buildBoard (ROM 0x0C92) are imported and
 *           called directly.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { buildBoard } from "./buildBoard.js";               // ROM 0x0C92

export function loc_0c91(m) {
  // Tick the sub-state countdown; build the board only on the frame it expires.
  if (!tickSubstateTimer(m)) return; // still counting down — nothing to do this frame
  buildBoard(m);
}
