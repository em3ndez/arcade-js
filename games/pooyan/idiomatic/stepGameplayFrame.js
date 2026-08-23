// SPDX-License-Identifier: GPL-3.0-only
import { loc_308b } from "./loc_308b.js";
import { loc_25a6 } from "./loc_25a6.js";
import { loc_3377 } from "./loc_3377.js";
import { loc_40bd } from "./loc_40bd.js";
import { advanceLeadActorSecondaryState } from "./advanceLeadActorSecondaryState.js";
import { loc_02ef } from "./loc_02ef.js";
/**
 * stepGameplayFrame — gameplay-state per-frame coordinator.
 *
 * Runs six per-frame sub-drivers in fixed order, then returns. Every effect lands in memory (the
 * formation, the actor arena, the lead actor, the sprite display list); no register survives.
 *
 * LIVE-OUT: none — a void per-frame driver.
 */
export function stepGameplayFrame(m) {
  loc_308b(m); // formation manager
  loc_25a6(m); // lift/marker column driver
  loc_3377(m); // enemy-actor per-record state sweep
  loc_40bd(m); // formation-record object-state dispatch
  advanceLeadActorSecondaryState(m); // lead actor secondary state machine
  loc_02ef(m); // sprite display-list rebuild
}
