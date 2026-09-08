// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateAfterDwellAndQueue -- the "dwell then step" play sub-state (sequence sub-state 3).
 *
 * WHAT IT IS
 *   One tick of the play frame's sequence state machine. It is dispatch slot 3 of both
 *   runPlayerOnePlayFrame and runPlayerTwoPlayFrame: a pure hold that waits out a short dwell and then
 *   nudges the top-level sequence forward. Galaxian's attract/play flow walks itself along a cascade of
 *   dwell timers, and this is one of those holds -- the round pauses in sub-state 3 until the timer
 *   expires, then advances to sub-state 4 (begins the play phase).
 *
 * ROLE IN THE MACHINE
 *   Selected off SEQUENCE_STATE (0x400a), the top-level sequence step index. It ticks the dwell-tier
 *   timer loc_4009 (the middle tier of the dwell cascade described in mechanisms.md); while that timer is
 *   still counting it returns and the machine stays put. On the timer's zero-cross it reloads the dwell to
 *   TIMER_RELOAD, increments SEQUENCE_STATE to the next sub-state, and enqueues this step's deferred
 *   command word via the command ring (loc_0682, keyed by the new SEQUENCE_STATE). The sequence advancing
 *   is literally the dwell timer's carry-out.
 *
 * ROM 0x0605.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- the reloaded dwell timer loc_4009, the stepped SEQUENCE_STATE, and the queued
 * command word. Returns enqueueCommandWord's result, which the dispatcher discards.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { loc_4009, SEQUENCE_STATE, loc_0682 } from "./names.js";

// Frames to hold in this sub-state after each expiry: the dwell is re-armed to this on every zero-cross.
const TIMER_RELOAD = 20;

export function advanceSubstateAfterDwellAndQueue(m) {
  const { mem8 } = m;

  // Tick the dwell-tier timer loc_4009 down one (wrapping at the byte boundary). While it is still
  // nonzero the hold continues and nothing else happens this frame -- the machine dwells in sub-state 3.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  // Zero-cross: the dwell has expired. Re-arm the timer for the next occupant of this slot, step the
  // top-level SEQUENCE_STATE to the next sub-state, and enqueue this state's deferred command word
  // (loc_0682, indexed by the just-incremented SEQUENCE_STATE) so its draw/sound work runs when the
  // command ring drains. This carry-out is exactly how the sequence machine advances a step.
  mem8[loc_4009] = TIMER_RELOAD;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  return enqueueCommandWord(m, loc_0682, SEQUENCE_STATE);
}
