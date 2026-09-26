// SPDX-License-Identifier: GPL-3.0-only
/** loc_4108 — service one counting slot of the per-slot object sweep: run the slot's object one
 * frame on its own countdown, then close the turn. LIVE-OUT: memory, the two cursors, the counter
 * and the wide scratch pair the turn close leaves. */

import { stepDriftingCountdownObjectByEraFrames } from "./stepDriftingCountdownObjectByEraFrames.js";
import { closeOneTurnOfTheSlotSweep } from "./closeOneTurnOfTheSlotSweep.js";

export function loc_4108(m) {
  stepDriftingCountdownObjectByEraFrames(m);
  return closeOneTurnOfTheSlotSweep(m);
}
