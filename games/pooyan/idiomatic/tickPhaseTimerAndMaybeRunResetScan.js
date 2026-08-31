// SPDX-License-Identifier: GPL-3.0-only
import { checksumIntegrityStripAndDispatchSpawn } from "./checksumIntegrityStripAndDispatchSpawn.js";
import { dispatchWriteAnimStateAndPollStart } from "./dispatchWriteAnimStateAndPollStart.js";
import { PHASE_TIMER, RESET_SCAN_LATCH } from "./names.js";
/**
 * tickPhaseTimerAndMaybeRunResetScan — phase-timer tick with reset-scan re-entry.
 *
 * Counts the phase timer down one step each frame. While the reset latch is armed and the timer
 * has just reached zero it re-enters the integrity-strip reset scan; otherwise it tails to the
 * (unlifted) write-animation dispatch redirect.
 *
 * LIVE-OUT: none — a tail-delegating frame step; every effect lands in the delegatee.
 */
export function tickPhaseTimerAndMaybeRunResetScan(m) {
  const { mem8 } = m;
  mem8[PHASE_TIMER]--; // tick the phase timer
  const timer = mem8[PHASE_TIMER];
  if (mem8[RESET_SCAN_LATCH] !== 0 && timer === 0) return checksumIntegrityStripAndDispatchSpawn(m); // re-enter the reset scan
  return dispatchWriteAnimStateAndPollStart(m); // tail to the write-animation dispatch redirect
}
