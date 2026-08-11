// SPDX-License-Identifier: GPL-3.0-only
/** stepFourActorSlots — run the same per-slot step over four slots in turn.
 *
 * The Z80 parked a resume address on the stack for each non-idle slot, because the frozen step it
 * handed to returned through a tail that lifted one off. Now that the step (dispatchObjectSlotByHeadByte) is a direct
 * call that lifts nothing, that park writes only dead scratch below the stack pointer, so it has
 * been retired -- exactly as the note it used to carry said it would be, "when that tail stops
 * lifting, the park goes with it." LIVE-OUT: memory, plus the two cursors the fourth slot left. */

import { dispatchObjectSlotByHeadByte } from "./dispatchObjectSlotByHeadByte.js";
import { ACTOR_ENTRY_SLOT0, ACTOR_ENTRY_SLOT1, ACTOR_ENTRY_SLOT2, ACTOR_ENTRY_SLOT3, ACTOR_RECORD_SLOT0, ACTOR_RECORD_SLOT1, ACTOR_RECORD_SLOT2, ACTOR_RECORD_SLOT3 } from "./names.js";

const SLOTS = [
  [ACTOR_RECORD_SLOT0, ACTOR_ENTRY_SLOT0],
  [ACTOR_RECORD_SLOT1, ACTOR_ENTRY_SLOT1],
  [ACTOR_RECORD_SLOT2, ACTOR_ENTRY_SLOT2],
  [ACTOR_RECORD_SLOT3, ACTOR_ENTRY_SLOT3],
];

export function stepFourActorSlots(m) {
  for (const [record, entry] of SLOTS) {
    m.regs.ix = record;
    m.regs.iy = entry;
    dispatchObjectSlotByHeadByte(m);
  }
}
