// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSequenceStepWhenTimerExpires — once the sub-state timer expires, increment the step
 * byte the SEQ_ADVANCE_PTR word points at (indirect; the pointer cell itself is untouched).
 * Returns a constant true — it cannot skip its own caller.
 *
 * LIVE-OUT: memory-only — the sub-state timer decremented inside the tick, and the byte at
 * *(SEQ_ADVANCE_PTR) incremented on the expiry frame.
 */

import { SEQ_ADVANCE_PTR } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

export function advanceSequenceStepWhenTimerExpires(m) {
  const { mem8, mem16 } = m;

  if (!tickSubstateTimer(m)) return true;

  const target = mem16[SEQ_ADVANCE_PTR];
  mem8[target] = mem8[target] + 1;

  return true;
}
