// SPDX-License-Identifier: GPL-3.0-only
import { tickFormationSpawnAndScanSlots } from "./tickFormationSpawnAndScanSlots.js";
import { dispatchAllHunterRecordStates } from "./dispatchAllHunterRecordStates.js";
import { LEAD_ACTOR_STATE } from "./names.js";
/**
 * runSpawnTickAndHunterSweep — spawn/formation epilogue. Runs only once the lead actor has reached state 3 or
 * more; below that it returns at once. At quorum it services the formation-spawn tick and
 * then drives the hunter records.
 *
 * LIVE-OUT: none — a void epilogue; every effect lands in the spawn/hunter state.
 */
const SPAWN_QUORUM = 0x03; // lead-actor state at or above which spawning runs

export function runSpawnTickAndHunterSweep(m) {
  if (m.mem8[LEAD_ACTOR_STATE] < SPAWN_QUORUM) return; // below quorum -> nothing to do
  tickFormationSpawnAndScanSlots(m); // formation-spawn tick
  return dispatchAllHunterRecordStates(m); // drive the hunter records
}
