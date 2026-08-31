// SPDX-License-Identifier: GPL-3.0-only
import { stepEnemyActorState } from "./stepEnemyActorState.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * stepEnemyActorStates — the per-object enemy state sweep.
 *
 * WHAT IT IS: the driver that advances every enemy actor's own state machine by one frame.
 * The enemies in Pooyan (the wolves that ride the ropes, plus the objects that share their
 * record format) each live as a fixed-size record in work RAM, and each record carries a state
 * index that says where that actor is in its personal script — climbing, holding, turning,
 * diving, falling, being caught, and so on. This routine does not itself contain any of that
 * logic; it is purely the loop that visits each record and hands it to the per-record state
 * dispatcher, which runs exactly one step of whatever state the record is in.
 *
 * ROLE IN THE MACHINE: this is called every worker frame — both directly in the sub-state 0/1
 * chain of the main play loop and again in the tail that runs after the per-frame handlers — so
 * every active enemy gets one state step per frame. It is one of several sweeps over the same
 * pool of records: this one visits the fourteen records that make up the enemy pool.
 *
 * MEMORY IT WALKS: the enemy records are a flat array of RECORD_COUNT entries, each RECORD_STRIDE
 * bytes wide, based at ENEMY_ACTOR_TABLE (0x8ae0). That base is simply slot 4 of the larger actor
 * arena that starts at 0x8a80; because every pool uses the same uniform record layout, a length of
 * fourteen from 0x8ae0 deliberately runs past the enemy slots into the adjacent object pools, which
 * expose their state byte at the same record offset.
 *
 * ROM: 0x1219-0x122b.
 * Grounding: [seen].
 *
 * LIVE-OUT: none — a void driver. It returns nothing and reads nothing back; every effect of the
 * frame lands inside the records the per-record dispatcher mutates as it steps each actor's state.
 */
// Loop bounds, both fixed constants baked into the routine at 0x1219.
// The count of fourteen (loaded as the loop counter B) and the 0x18 stride (loaded as DE and
// added to the record pointer each pass) are exactly the values the machine sets before it enters
// its per-record loop. Fourteen records at a 24-byte stride span from ENEMY_ACTOR_TABLE (0x8ae0)
// up to 0x8c00, covering the enemy pool and overrunning into the neighbouring object records that
// share the identical record shape.
const RECORD_COUNT = 0x0e; // 14 records
const RECORD_STRIDE = 0x18; // 24 bytes per record

export function stepEnemyActorStates(m) {
  // Start the record pointer at the base of the enemy pool (0x8ae0). The machine keeps this
  // pointer, and its loop counter, intact across each dispatch, so the sweep resumes cleanly at
  // the next record even though the per-record handler is free to touch anything.
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Hand this one record to the per-record state dispatcher (ROM 0x122c). That routine rejects
    // a dormant record (bit 0 of its two-byte header clear) and any out-of-range state (state
    // byte & 0x1f >= 0x11), otherwise routes the record to the handler for its current sub-state,
    // which advances that actor's state machine by a single frame. Any change it makes is written
    // straight into this record's bytes in place.
    stepEnemyActorState(m, rec);
    // Advance to the next record. Adding the 0x18 stride walks forward one fixed-size slot,
    // stepping through the enemy pool (and into the object pools that follow it in RAM).
    rec += RECORD_STRIDE;
  }
}
