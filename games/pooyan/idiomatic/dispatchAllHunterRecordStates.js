// SPDX-License-Identifier: GPL-3.0-only
import { ENEMY_ACTOR_TABLE } from "./names.js";
import { loc_2c3f } from "./loc_2c3f.js";

/**
 * dispatchAllHunterRecordStates — run every hunter record's state machine for one frame.
 *
 * WHAT IT IS
 *   The per-frame driver for Pooyan's "hunter" attack wave. When a wave of hunters is on the
 *   board, each hunter lives as one fixed-size 0x18-byte record inside the shared enemy-actor
 *   pool that begins at ENEMY_ACTOR_TABLE (0x8ae0). This routine is the outer sweep that visits
 *   those records in order and hands each one to the per-hunter-record state dispatcher, so that
 *   every hunter advances its own little state machine exactly once per frame.
 *
 * ITS ROLE IN THE MACHINE
 *   The actor arena is a flat array of uniform 0x18-byte records; because the records are uniform,
 *   the game reuses ENEMY_ACTOR_TABLE (0x8ae0) as the base of whatever pool a given subsystem
 *   wants to walk, picking a length to suit. This sweep is the hunter subsystem's pass: it runs a
 *   long 17-record span (stride 0x18) that deliberately reaches past the enemy sub-array into the
 *   adjacent record pools, since a hunter can occupy any of those slots. It is one of several such
 *   per-frame arena sweeps (the enemy-actor and object drivers walk the same base with different
 *   lengths); this one carries the hunters through the top of the shared actor state machine.
 *
 * WHAT THE INNER DISPATCHER DECIDES (per record)
 *   For each record it is handed, the per-hunter-record dispatcher applies two guards and then a
 *   four-way branch: a dormant slot (presence bit clear in the record header) is skipped; a record
 *   whose masked state byte is below the hunter dispatch band (states 0x11..0x14) is skipped; and
 *   an in-band record is routed to the handler for its state — climb-and-gather, movement-script
 *   step, climb-and-retire, or inter-wave-hold collapse.
 *
 * THE ABORT SIGNAL
 *   The dispatcher answers with a boolean. True means "record handled, keep sweeping"; false means
 *   "abort the rest of this frame's pass over the records". False is raised by the handlers that
 *   end a phase for the whole wave — the frame a hunter's spawn/promote handler runs, or a record
 *   retires, or the inter-wave hold collapses — because those actions restructure the record set
 *   out from under the walk, so the remaining records are intentionally left for the next frame.
 *   This sweep therefore stops the moment it sees false rather than finishing the count.
 *
 * ROM: 0x2c2c–0x2c3e.
 * Grounding: [seen]
 * LIVE-OUT: memory only — every effect lands in the hunter records via the inner dispatcher; the
 *   caller reads nothing back (it returns straight to its own caller).
 */

// Records are laid out end to end at a fixed pitch, so stepping the pointer by one stride advances
// from one hunter record to the next.
const RECORD_STRIDE = 0x18;
// The hunter pass covers 17 (0x11) records starting at ENEMY_ACTOR_TABLE — a longer span than the
// enemy-only sweeps, reaching into the neighbouring pools where a hunter may also be seeded.
const HUNTER_RECORD_COUNT = 0x11;

export function dispatchAllHunterRecordStates(m) {
  // Start the walk at the base of the enemy-actor pool (0x8ae0), the first hunter record.
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < HUNTER_RECORD_COUNT; i++) {
    // Run this one record's state machine. The dispatcher returns false when a handler ends the
    // wave-phase and thereby reshapes the record set, which aborts the rest of this frame's pass.
    if (!loc_2c3f(m, rec)) return; // per-record dispatcher; false aborts the sweep
    // Advance to the next record in the arena (one 0x18-byte stride forward).
    rec += RECORD_STRIDE;
  }
}
