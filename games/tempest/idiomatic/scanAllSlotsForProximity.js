// SPDX-License-Identifier: GPL-3.0-only
import { SLOT_STATE } from "./names.js";
import { resolveSlotProximityInteractions } from "./resolveSlotProximityInteractions.js";

// Scan slots x = 7..0; each nonzero entry drives the per-slot mover with that entry as the
// threshold and x as the slot index.
export function scanAllSlotsForProximity(m) {
  const { mem8 } = m;
  for (let x = 7; x >= 0; x--) {
    const entry = mem8[SLOT_STATE + x];
    if (entry !== 0) resolveSlotProximityInteractions(m, entry, x);
  }
}
