// SPDX-License-Identifier: GPL-3.0-only
import { checksumIntegrityStripAndDispatchSpawn } from "./checksumIntegrityStripAndDispatchSpawn.js";
import { dispatchWriteAnimStateAndPollStart } from "./dispatchWriteAnimStateAndPollStart.js";
import { PHASE_TIMER, RESET_SCAN_LATCH } from "./names.js";
/**
 * tickPhaseTimerAndMaybeRunResetScan — phase-timer tick with reset-scan re-entry.
 *
 * WHAT IT IS
 *   A tiny per-frame decision step (ROM 0x2b23-0x2b33) that lives at the junction between two
 *   quite different modes: the ongoing round/attract animation, and the one-shot "reset scan"
 *   that re-initialises the playfield after a round or a tamper check. Every frame it advances
 *   the phase timer by one step and then chooses which of those two paths runs this frame.
 *
 * ROLE IN THE MACHINE
 *   The playfield display is driven by a phase timer (PHASE_TIMER, 0x8808): a countdown that
 *   paces the scripted screen transitions. Separately, a reset-scan latch (RESET_SCAN_LATCH,
 *   0x8e2a) is armed by the round-teardown chain to say "an integrity-strip reset scan is
 *   pending; run it the moment this phase's timer runs out." This routine is where that promise
 *   is kept: it decrements the timer, and if the latch is armed AND the timer has just hit zero
 *   it hands control to the integrity-strip reset scan; otherwise it lets the ordinary
 *   write-animation pre-pass run (which itself ends in the start-button poll).
 *
 *   The 16 bytes at 0x2b23 also do double duty as anti-tamper data: they are the reversed
 *   reference block (STATE5_SIGCHECK_REF_TOP) that the actor state-5 signature check reads
 *   downward to verify the reinit code window is intact. That is a property of the ROM region,
 *   not of the work this frame step does.
 *
 * ROM: 0x2b23-0x2b33.
 * Grounding: [seen]
 *
 * LIVE-OUT: none — a tail-delegating frame step. The only state this routine itself writes is
 *   the one-step decrement of PHASE_TIMER (0x8808); every further effect lands in whichever
 *   delegatee it tails to this frame.
 */
export function tickPhaseTimerAndMaybeRunResetScan(m) {
  const { mem8 } = m;
  // Advance the phase timer one step (ROM 0x2b23 `ld hl,0x8808` / 0x2b26 `dec (hl)`).
  // PHASE_TIMER (0x8808) is the countdown that paces the current screen phase; every frame that
  // reaches this step burns one tick off it. The teardown chain reseeds it (e.g. to 0x60 or 0x80)
  // when it wants a phase to last a fixed number of frames, and reads the drained-to-zero value
  // below as the "phase over" signal.
  mem8[PHASE_TIMER]--; // tick the phase timer
  // Snapshot the freshly-decremented timer so the expiry test below reads the post-tick value
  // (matching ROM 0x2b2d `ld a,(hl)` reading the same 0x8808 cell that `dec (hl)` just wrote).
  const timer = mem8[PHASE_TIMER];
  // Reset-scan gate (ROM 0x2b27 `ld a,(0x8e2a)` / `and a` / 0x2b2b `jr z` skips the scan when
  // the latch is clear; 0x2b2d `ld a,(hl)` / `and a` / 0x2b2f `jr z` takes the scan only on
  // timer==0). Both conditions must hold: the reset-scan latch (RESET_SCAN_LATCH, 0x8e2a) is
  // armed AND the phase timer has just expired. When they do, re-enter the integrity-strip reset
  // scan (checksumIntegrityStripAndDispatchSpawn, 0x2b59): it blanks an attribute column, checks
  // a ten-byte integrity strip against its magic total, and on a match clears the latch and
  // dispatches the round re-init / spawn. Ordering matters — the latch is read first, so a
  // disarmed latch short-circuits and the timer never gates this branch.
  if (mem8[RESET_SCAN_LATCH] !== 0 && timer === 0) return checksumIntegrityStripAndDispatchSpawn(m); // re-enter the reset scan
  // Ordinary path (ROM 0x2b31 `call 0x7e94`): the latch is disarmed, or it is armed but the phase
  // has not yet expired. Hand off to the write-animation dispatch pre-pass
  // (dispatchWriteAnimStateAndPollStart, 0x7e94), which runs the per-frame write-anim handler and
  // then tails into the start-button poll — the normal attract/round animation for this frame.
  return dispatchWriteAnimStateAndPollStart(m); // tail to the write-animation dispatch redirect
}
