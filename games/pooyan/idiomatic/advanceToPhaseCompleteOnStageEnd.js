// SPDX-License-Identifier: GPL-3.0-only
import {
  STAGE_COUNTDOWN,
  MAINLOOP_SUBSTATE_SELECTOR,
  SUBSTATE_FIELD1_COUNTER,
  PHASE1_COMPLETE_DISPLAY_CMD,
} from "./names.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";

/**
 * advanceToPhaseCompleteOnStageEnd — a main-loop sub-state handler, gated on the stage countdown.
 *
 * While the stage-countdown guard is still non-zero it bails. Otherwise it advances the
 * main-loop sub-state selector, enqueues the phase-1-complete display command into the display
 * ring, and seeds the sub-state field-1 counter with 64 for the next phase.
 *
 * LIVE-OUT: memory only — the incremented selector, the enqueued command, and the seeded
 * countdown. No register output.
 */

const NEXT_PHASE_COUNT = 64; // value seeded into the field-1 countdown for the next phase

export function advanceToPhaseCompleteOnStageEnd(m) {
  const { mem8 } = m;

  if (mem8[STAGE_COUNTDOWN] !== 0) return; // guard still busy — bail

  mem8[MAINLOOP_SUBSTATE_SELECTOR] += 1;
  enqueueDisplayCommand(m, PHASE1_COMPLETE_DISPLAY_CMD); // enqueue the phase-1-complete display command
  mem8[SUBSTATE_FIELD1_COUNTER] = NEXT_PHASE_COUNT;
}
