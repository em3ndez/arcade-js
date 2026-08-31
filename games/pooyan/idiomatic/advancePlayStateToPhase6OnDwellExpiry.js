// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { spawnHunterIntoFreeSlot } from "./spawnHunterIntoFreeSlot.js";
import {
  SUBSTATE_FIELD1_COUNTER,
  LATCHED_ENEMY_X,
  PLAY_STATE_INDEX,
  SCORE_DRIP_ACCUM,
  TAMPER_STRIKES_HUD_GUARD,
} from "./names.js";

/**
 * advancePlayStateToPhase6OnDwellExpiry — main-loop sub-state 5 handler.  ROM 0x114f.  Grounding: [seen].
 *
 * WHAT IT IS
 *   One of six handlers reached from the main-loop sub-state dispatcher: that dispatcher masks
 *   MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) with 7 and jumps through an inline table, and selector value 5
 *   lands here. Its job is to hold the machine in a fixed dwell for a set number of frames, then, when
 *   the dwell runs out, tear the sub-state scratch region down and push the round forward into its next
 *   play phase.
 *
 * ROLE IN THE MACHINE
 *   This handler sits on the timed hand-off between one stretch of a round and the next. A short-lived
 *   countdown, SUBSTATE_FIELD1_COUNTER (0x8f62), meters the dwell. Each frame the handler is entered it
 *   spends one tick of that countdown and does nothing else; the game visibly idles for those frames.
 *   The frame the countdown reaches zero is the transition frame: the whole main-loop sub-state scratch
 *   block is wiped, sound is silenced, the in-play phase index is stepped to phase 6, and — unless the
 *   game is in a quiescent state — a fresh hunter is seeded into the object world so the next phase has
 *   an actor to drive.
 *
 * LIVE-OUT (memory only)
 *   While counting: SUBSTATE_FIELD1_COUNTER (0x8f62), decremented by one.
 *   On the expiry frame: the 9-byte scratch block 0x8f5b..0x8f63 zeroed (this spans LATCHED_ENEMY_X,
 *   MAINLOOP_SUBSTATE_SELECTOR and the countdown itself, so the main-loop sub-state machine is reset to
 *   state 0); the sound-command ring, with command 0x00 (silence) enqueued; PLAY_STATE_INDEX (0x880a)
 *   set to 6; and, when the spawn sweep runs, whatever object-slot writes it makes. No register is left
 *   as a result — the dispatcher reloads its own registers after this handler returns.
 */

const CLEAR_LEN = 0x09; // bytes cleared from the block base on expiry
const NEXT_PHASE = 0x06; // phase written when the timer expires

export function advancePlayStateToPhase6OnDwellExpiry(m) {
  const { mem8 } = m;

  // Dwell tick. SUBSTATE_FIELD1_COUNTER (0x8f62) is the frame countdown that meters how long the
  // machine sits in this sub-state. While it is still non-zero the handler is in its holding pattern:
  // spend exactly one frame off the counter and return, doing nothing else this frame. The transition
  // work below runs only on the single frame the counter is already zero on entry.
  const timer = mem8[SUBSTATE_FIELD1_COUNTER];
  if (timer !== 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] = timer - 1;
    return;
  }

  // --- The dwell has expired: run the one-shot transition into the next phase. ---

  // Tear down the sub-state scratch block. Zero CLEAR_LEN (9) bytes starting at LATCHED_ENEMY_X
  // (0x8f5b), which covers the contiguous run 0x8f5b..0x8f63. That run holds the latched enemy screen-X,
  // the main-loop sub-state selector MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) and this handler's own
  // countdown at 0x8f62, so clearing it both wipes the stale enemy latch and returns the main-loop
  // sub-state selector to 0 for whatever comes next.
  fillByteRun(m, LATCHED_ENEMY_X, 0, CLEAR_LEN);

  // Silence audio across the transition. Enqueue sound command 0x00 into the sound-command ring so the
  // dwell's audio is cut before the next phase starts its own.
  queueSoundCommand00(m);

  // Advance the round. Step the in-play sub-state index PLAY_STATE_INDEX (0x880a) to NEXT_PHASE (6);
  // the play-frame dispatcher will run phase 6's handler on subsequent frames.
  mem8[PLAY_STATE_INDEX] = NEXT_PHASE;

  // Gate the actor spawn. Sum the score-drip accumulator SCORE_DRIP_ACCUM (0x882b) and the tamper-strike
  // guard byte TAMPER_STRIKES_HUD_GUARD (0x8a3c), taking the low 8 bits. When both are zero — the
  // quiescent case on an intact machine with nothing accrued — the handler simply returns and the next
  // phase begins with no new actor.
  const sum = (mem8[SCORE_DRIP_ACCUM] + mem8[TAMPER_STRIKES_HUD_GUARD]) & 0xff;
  if (sum === 0) return;

  // Otherwise hand off to the object-slot spawn sweep, which walks the actor records and seeds the first
  // free one (and no-ops if every record is already active), giving the incoming phase a hunter to run.
  spawnHunterIntoFreeSlot(m);
}
