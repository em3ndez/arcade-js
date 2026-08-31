// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_7638 } from "./loc_7638.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";

// Byte distance between consecutive enemy-actor records. Each record is a fixed 0x18 (24) bytes, so
// advancing the cursor by STRIDE steps from one record to the next in the packed table.
const STRIDE = 0x18; // enemy-actor record stride

/**
 * advanceEnemyActorStateWalk — shared per-frame animation-tick walk over the enemy-actor pool.
 *
 * WHAT IT IS
 *   ROM 0x7627-0x7638. Grounding: [seen].
 *   The common body behind two twin entry points that differ only in how many records they cover:
 *   advanceAllEnemyActorStates (0x7621) seeds a count of 0x0e (14 records) and
 *   advanceFirstGroupEnemyActorStates (0x7625) seeds a count of 0x08 (8 records); each seeds the
 *   count into register B and drops into this body.
 *
 * ROLE IN THE MACHINE
 *   Once per frame the game nudges the animation state of its enemy actors — the attackers that make
 *   up a wave. This routine sweeps a run of records at the enemy-actor table
 *   (ENEMY_ACTOR_TABLE = 0x8ae0), stride 0x18, and hands each record to the per-entry animation tick
 *   (loc_7638). That tick dispatches on the record's state byte (byte +2, masked to 0..3) to one of
 *   three state handlers, which advance the record's animation frame and, at certain phase
 *   boundaries, perform a group reseed of the shared enemy state — e.g. resetting every record's
 *   state byte, or arming the next attack phase (its shared countdown at 0x892e and phase latches).
 *
 *   When a tick performs such a phase-transition reseed it reports back false, and this sweep aborts
 *   immediately, leaving the records it has not yet reached untouched this frame. The reseed has
 *   already rewritten the shared state those later records would be ticked from, so finishing the
 *   pass would be meaningless; the sweep resumes cleanly from the new phase on the next frame.
 *
 * LIVE-OUT
 *   Nothing is handed back to the caller. All effect is in memory: the per-entry tick mutates the
 *   enemy-actor records (frame counters and state bytes) plus the shared phase countdown / phase
 *   latches it reseeds. The caller reads no value back.
 */
export function advanceEnemyActorStateWalk(m, count = m.regs.b) {
  // Point the cursor at the first enemy-actor record. The machine keeps this record address in IX
  // and the 0x18 stride in DE; here `ix` is the running address into the 0x8ae0 table.
  let ix = ENEMY_ACTOR_TABLE;
  // Tick `count` records in table order. `count` is the record count carried in from entry register
  // B (14 for the all-records entry, 8 for the first-group entry).
  for (let n = count; n > 0; n--) {
    // Hand this record to the per-entry animation tick (loc_7638). It reports true to keep sweeping;
    // it reports false when its state handler performed a phase-transition reseed of the shared
    // enemy state, at which point the rest of this frame's sweep is abandoned at once.
    if (!loc_7638(m, ix)) return; // a tick aborted the walk
    // Step the cursor to the next record in the packed table (address += 0x18).
    ix = u16(ix + STRIDE);
  }
}
