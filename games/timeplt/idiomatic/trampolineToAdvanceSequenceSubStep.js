// SPDX-License-Identifier: GPL-3.0-only
/** trampolineToAdvanceSequenceSubStep — a sequence step that does no work of its own -- it only
 * moves the inner index on, so reaching it costs one turn and changes nothing else.
 *
 * ROLE. The sequence machine runs one sub-step routine per dispatch, picked from a word table by
 * the current phase and sub-step. An entry that points here is a no-op slot: its whole
 * effect is to step the sub-step index on, so the machine spends one dispatch passing through it
 * and arrives at the next entry on the following one.
 *
 * ROM 0x17FB-0x17FD, a single `jp 0x0f1a` -- a tail jump, nothing pushed, so the dispatcher's own
 * return carries back from advanceSequenceSubStep (frozen lift translated/loc_17fb.js).
 * Grounding: [seen] (names.js ROUTINES 0x17fb). LIVE-OUT: memory (the sub-step index).
 */

import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";

export function trampolineToAdvanceSequenceSubStep(m) {
  // The entire routine: hand over to the shared "step the sub-step index on by one" (ROM 0x0F1A).
  advanceSequenceSubStep(m);
}
