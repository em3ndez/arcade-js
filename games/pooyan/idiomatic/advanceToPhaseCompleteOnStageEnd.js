// SPDX-License-Identifier: GPL-3.0-only
import {
  STAGE_COUNTDOWN,
  MAINLOOP_SUBSTATE_SELECTOR,
  SUBSTATE_FIELD1_COUNTER,
  PHASE1_COMPLETE_DISPLAY_CMD,
} from "./names.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";

/**
 * advanceToPhaseCompleteOnStageEnd — the stage-end trigger that hands the main loop
 * from active play into the scripted phase-complete / bonus-transition sequence.
 *
 * ROM 0x107d-0x108f. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * The ordinary play loop is a six-way state machine keyed on MAINLOOP_SUBSTATE_SELECTOR
 * (0x8f5c): state 0 re-arms the frame, state 1 (runActivePlayFrame) is the heart of active
 * play, and states 2..5 form a one-way scripted countdown that stages the round/bonus
 * transition. This routine is step 3 of runActivePlayFrame's fixed ten-step per-frame
 * chain — it runs every active-play frame, right after the HUD refresh and the lead-actor
 * input seed, and its whole job is to watch the per-stage countdown and, the instant that
 * countdown expires, flip the state machine out of active play and start the scripted
 * hand-off.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * STAGE_COUNTDOWN (0x8901) is a per-stage down-counter (seeded 0x20, drained toward 0 as a
 * stage plays out). While it is still non-zero the stage is in progress and this routine
 * does nothing. When it hits zero the stage is over, and this routine performs the three
 * acts that end active play:
 *   1. advance MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) by one — this moves the selector from
 *      state 1 (active play) into state 2, the first of the scripted countdown sub-states
 *      (queueBonusStageTallyDisplayOnDelay), so the next frames march 2 -> 3 -> 4 -> 5;
 *   2. enqueue the phase-1-complete display command into the display-command ring so the
 *      screen reacts to the phase ending;
 *   3. pre-load SUBSTATE_FIELD1_COUNTER (0x8f62) with 0x40 — the delay the newly-entered
 *      state 2 will count down before it advances the script further.
 *
 * LIVE-OUT: memory only — the incremented sub-state selector at 0x8f5c, the newly-queued
 * display command in the ring, and the seeded countdown at 0x8f62. No register output.
 */

// 0x40 (64) frames: the delay this routine pre-loads into the field-1 counter so that the
// scripted sub-state it hands off to (state 2, queueBonusStageTallyDisplayOnDelay) has a
// countdown ready to drain before it advances the transition script.
const NEXT_PHASE_COUNT = 64; // value seeded into the field-1 countdown for the next phase

export function advanceToPhaseCompleteOnStageEnd(m) {
  const { mem8 } = m;

  // GUARD (ROM 0x107d: ld a,(0x8901) / and a / ret nz). STAGE_COUNTDOWN (0x8901) drains
  // toward zero across the stage. While it is still non-zero the stage has not ended, so
  // bail and leave the state machine in active play — the remaining nine steps of the
  // per-frame worker chain continue to run this frame regardless.
  if (mem8[STAGE_COUNTDOWN] !== 0) return; // guard still busy — bail

  // STAGE END — the countdown reached zero, so end active play and start the scripted
  // transition.

  // Step 1 (ROM 0x1082: ld hl,0x8f5c / inc (hl)). Advance the main-loop sub-state selector
  // (0x8f5c) by one, moving it from state 1 (active play) into state 2, the first of the
  // one-way scripted countdown sub-states that stage the round/bonus transition.
  mem8[MAINLOOP_SUBSTATE_SELECTOR] += 1;

  // Step 2 (ROM 0x1086: ld de,0x0635 / rst 0x38). Append the phase-1-complete display
  // command (0x0635) to the display-command ring; the ring's consumer will drain it and
  // paint the phase-ending display.
  enqueueDisplayCommand(m, PHASE1_COMPLETE_DISPLAY_CMD); // enqueue the phase-1-complete display command

  // Step 3 (ROM 0x108a: ld a,0x40 / ld (0x8f62),a). Seed the field-1 counter (0x8f62) with
  // 0x40 so the sub-state just entered (state 2) has a fresh countdown to drain before it
  // marches the transition script onward.
  mem8[SUBSTATE_FIELD1_COUNTER] = NEXT_PHASE_COUNT;
}
