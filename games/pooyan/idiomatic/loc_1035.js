// SPDX-License-Identifier: GPL-3.0-only
import { stepActiveTargetActorRecords } from "./stepActiveTargetActorRecords.js";
import { loc_1219 } from "./loc_1219.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { loc_02ef } from "./loc_02ef.js";

/**
 * loc_1035 — the main-loop post-handler tail: run the four per-frame update passes in order.
 *
 * Steps the active target actor records, sweeps the per-object state dispatch, runs the
 * formation object-state dispatcher, then rebuilds the sprite display list. Pure sequencing.
 *
 * LIVE-OUT: memory only — whatever the four passes write. No register output.
 */

export function loc_1035(m) {
  stepActiveTargetActorRecords(m);
  loc_1219(m);
  dispatchFormationObjectStates(m);
  loc_02ef(m);
}
