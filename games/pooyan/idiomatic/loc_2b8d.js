// SPDX-License-Identifier: GPL-3.0-only
import { loc_2b9a } from "./loc_2b9a.js";
import { loc_2c2c } from "./loc_2c2c.js";
import { LEAD_ACTOR_STATE } from "./names.js";
/**
 * loc_2b8d — spawn/formation epilogue. Runs only once the lead actor has reached state 3 or
 * more; below that it returns at once. At quorum it services the formation-spawn tick and
 * then drives the hunter records.
 *
 * LIVE-OUT: none — a void epilogue; every effect lands in the spawn/hunter state.
 */
const SPAWN_QUORUM = 0x03; // lead-actor state at or above which spawning runs

export function loc_2b8d(m) {
  if (m.mem8[LEAD_ACTOR_STATE] < SPAWN_QUORUM) return; // below quorum -> nothing to do
  loc_2b9a(m); // formation-spawn tick
  return loc_2c2c(m); // drive the hunter records
}
