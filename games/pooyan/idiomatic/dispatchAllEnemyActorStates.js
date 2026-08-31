// SPDX-License-Identifier: GPL-3.0-only
import { dispatchActiveEnemyActorState } from "./dispatchActiveEnemyActorState.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * dispatchAllEnemyActorStates — per-frame state sweep over the enemy-actor pool.
 * ROM 0x3377.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The enemy world lives in a table of uniform, fixed-size actor records: ENEMY_ACTOR_TABLE at
 *   0x8ae0, fourteen records laid back-to-back at a stride of 0x18 (24 bytes) each.  Every record
 *   is a little state machine — its header byte says whether the slot is live, and a state field
 *   selects which behaviour the actor is currently running (falling, diving, flapping, dying, …).
 *
 * ROLE IN THE MACHINE
 *   This is the once-per-frame driver that advances that whole population by one tick.  It does no
 *   actor logic of its own; it just visits each of the fourteen records in order and hands the
 *   record's address to the per-record dispatcher, which reads that record's header and state field
 *   and runs the one handler the record's current state selects.  All the game's enemy behaviour
 *   for the frame therefore fans out from this single walk.  (A twin driver, stepEnemyActorStates
 *   at 0x1219, walks the same table the same way for the animation pass.)
 *
 * LIVE-OUT
 *   None — a void driver.  It returns nothing; every effect lands inside the records it sweeps,
 *   written there by the per-record dispatcher it invokes.
 */
// Fourteen actor records make up the enemy pool that this sweep advances (0x0e = 14).
const RECORD_COUNT = 0x0e; // 14 records
// Each record occupies 0x18 = 24 contiguous bytes, so the next record's base is one stride further
// along in the arena; the records are uniform, which is what lets a single loop walk them all.
const RECORD_STRIDE = 0x18; // 24 bytes per record

export function dispatchAllEnemyActorStates(m) {
  // Point at the first record.  ENEMY_ACTOR_TABLE (0x8ae0) is the base of the fourteen-record enemy
  // pool; `rec` is the running pointer that will step across the table one record at a time.
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Advance this one record by a frame.  The per-record dispatcher (dispatchActiveEnemyActorState,
    // ROM 0x338a) is the low-state variant: given the record's base address it checks the record's
    // live/dormant header and its masked state field, and runs the handler that state selects,
    // mutating this record in place.  A dormant or out-of-range record is left untouched.
    dispatchActiveEnemyActorState(m, rec);
    // Step the pointer to the base of the next record, one 24-byte stride further along the table,
    // so the next iteration dispatches the following actor.
    rec += RECORD_STRIDE;
  }
}
