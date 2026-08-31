// SPDX-License-Identifier: GPL-3.0-only
import { tickFormationSpawnAndScanSlots } from "./tickFormationSpawnAndScanSlots.js";
import { dispatchAllHunterRecordStates } from "./dispatchAllHunterRecordStates.js";
import { LEAD_ACTOR_STATE } from "./names.js";
/**
 * runSpawnTickAndHunterSweep — the spawn/formation epilogue of the play frame.
 *
 * WHAT IT IS
 *   A small gatekeeping coordinator at ROM 0x2b8d. Once per frame it checks how far the lead
 *   actor has advanced through its own state machine and, only if that actor has "settled in",
 *   runs the two heavy enemy-population passes: the formation-spawn tick and the hunter sweep.
 *   Below the threshold it does nothing at all and returns immediately.
 *
 * ROLE IN THE MACHINE
 *   The lead actor (the player, slot 0 of the actor arena at ACTOR_TABLE 0x8a80) walks its own
 *   state machine as a board comes to life — spawning in, dropping into position, and finally
 *   reaching the steady in-play state. Its current position in that state machine lives in the
 *   record's state byte, +0x02 from the record base, which is LEAD_ACTOR_STATE (0x8a82). This
 *   epilogue treats that byte as a readiness quorum: it holds off populating the board with
 *   formation members and hunters until the lead actor has climbed to state 3 or above. That
 *   sequencing keeps enemies from being spawned into a board whose player is still animating in.
 *
 * ROM ADDRESS
 *   0x2b8d-0x2b99.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none — a void epilogue. It returns nothing of its own; every effect it produces
 *   lands inside the spawn and hunter state that its two callees rewrite (the formation-spawn
 *   countdown, the formation slot table, and the per-record hunter state bytes).
 */
const SPAWN_QUORUM = 0x03; // lead-actor state at or above which spawning runs

export function runSpawnTickAndHunterSweep(m) {
  // Readiness gate (ROM 0x2b8d-0x2b92: ld a,(0x8a82) / cp 0x03 / ret c).
  // Read the lead actor's state byte, LEAD_ACTOR_STATE (0x8a82) — the +0x02 state-index field of
  // slot 0 of the actor arena. If it is below the quorum of 3, the player has not yet settled
  // into its steady in-play state, so the board is not ready to be populated: bail out and do
  // nothing this frame. (The Z80 "cp 0x03 / ret c" returns exactly when the value is < 3.)
  if (m.mem8[LEAD_ACTOR_STATE] < SPAWN_QUORUM) return; // below quorum -> nothing to do
  // Formation-spawn tick (ROM 0x2b93: call 0x2b9a).
  // At quorum, service the formation-spawn machinery: ready-sprite prep, decrement the
  // formation-spawn countdown (FORMATION_SPAWN_TIMER 0x8d30, seeded from the level's arrival count),
  // and — when that countdown reaches 0 — run the slot-scan spawn loop that fills the formation
  // slot table. This is what marches new formation members onto the board.
  tickFormationSpawnAndScanSlots(m); // formation-spawn tick
  // Hunter sweep (ROM 0x2b96: call 0x2c2c).
  // Then walk the 17 hunter records, handing each to the per-record state dispatcher so every
  // active hunter advances its own state machine for this frame. This is the tail call of the
  // epilogue; whatever it leaves in the hunter records is the whole result of this routine.
  return dispatchAllHunterRecordStates(m); // drive the hunter records
}
