// SPDX-License-Identifier: GPL-3.0-only

/**
 * initSpawnedObjectFromGridCell — first-tick initialisation of a freshly-launched attacker object.
 *
 * WHAT IT IS
 *   Slot 0 of the object-AI dispatch table (0x0ce6): the handler an object runs on its very first frame,
 *   before it starts flying. Its siblings in that table are advanceObjectPathStep (0x0d71),
 *   advanceObjectDiveStep (0x0e6b) and reseedFormationObjectState (0x0e99). This handler turns a bare
 *   object record — which so far holds only its packed formation grid cell and a direction bit — into a
 *   fully seeded, on-screen diving attacker, then advances its sub-state so next frame it flies.
 *
 * ROLE IN THE MACHINE
 *   Reached once per object right after launchAttackerFromFormation claims it a slot. It raises the global
 *   spawn flag (loc_41c2), places the sprite from the grid cell (positionObjectFromGridCell), enqueues a
 *   type-1 spawn command word, and reads the object's sprite number and flight-curve seed out of the ROM
 *   SPAWN_RECORD_TABLE (0x1dd1) indexed by grid row. The top formation row additionally tallies how many
 *   of its two neighbour slots are still live into ACTIVE_NEIGHBOR_COUNT (0x422a). Input: obj = the object
 *   record base (IX). Writes fields of that record; advances record byte 2 (the AI sub-state).
 *
 * ROM 0x0d06.  Grounding: [seen].
 */
import { positionObjectFromGridCell } from "./positionObjectFromGridCell.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { loc_41c2, SPAWN_RECORD_TABLE, ACTIVE_NEIGHBOR_COUNT } from "./names.js";

// Object-record field offsets (base IX).
const OBJ_STATE = 2;          // dispatch sub-state (advanced here)
const OBJ_HEADING = 5;        // signed heading
const OBJ_DIRECTION = 6;      // bit0 selects the heading sign
const OBJ_GRID_CELL = 7;      // packed row/column grid cell
const OBJ_ATTR_BASE = 15;     // display attribute base
const OBJ_MOVE_THROTTLE = 16;
const OBJ_LEG_COUNT = 17;
const OBJ_STEP_TIMER = 23;    // cleared on spawn
const OBJ_WALK_CURSOR = 19;
const OBJ_SPRITE_NO = 22;
const OBJ_CURVE_SEED = 24;
const OBJ_NEXT_ACTIVE = 32;   // bit0 = active flag of the next neighbour slot
const OBJ_SECOND_ACTIVE = 64; // bit0 = active flag of the slot beyond it

// A grid cell whose three row bits (4-6) are all set lands on record index 14 — the front (top) formation
// row, which alone tallies its neighbours and takes a nonzero display-attribute base.
const TOP_ROW_INDEX = 14; // record index (row*2) when the grid-cell row bits are all set

export function initSpawnedObjectFromGridCell(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Clear the per-object step timer and raise the shared spawn flag other subsystems watch.
  mem8[obj + OBJ_STEP_TIMER] = 0;
  mem8[loc_41c2] = 1; // raise the spawn flag

  // Derive the sprite's screen position from the packed grid cell.
  positionObjectFromGridCell(m, obj);

  // Enqueue the object's spawn command word (channel 1, argument = the packed grid cell).
  const cell = mem8[obj + OBJ_GRID_CELL];
  enqueueCommandWord(m, (1 << 8) | cell); // spawn command word: type 1, grid cell

  // Row bits (grid-cell bits 4-6) index a 2-byte {sprite#, curve seed} record.
  const recordIndex = (cell & 0x70) >> 3;
  mem8[obj + OBJ_SPRITE_NO] = mem8[SPAWN_RECORD_TABLE + recordIndex];
  mem8[obj + OBJ_CURVE_SEED] = mem8[SPAWN_RECORD_TABLE + recordIndex + 1];

  if (recordIndex === TOP_ROW_INDEX) {
    // Front-row attacker: give it the front-row attribute base and count its two live neighbour slots so
    // the formation knows how much of the front rank is peeling off at once.
    mem8[obj + OBJ_ATTR_BASE] = 24;
    let neighbours = 0;
    if (mem8[obj + OBJ_NEXT_ACTIVE] & 1) neighbours++;
    if (mem8[obj + OBJ_SECOND_ACTIVE] & 1) neighbours++;
    mem8[ACTIVE_NEIGHBOR_COUNT] = neighbours;
  } else {
    // Rear-row attacker: plain attribute base, no neighbour tally.
    mem8[obj + OBJ_ATTR_BASE] = 0;
  }

  // Shared tail: seed the object's motion counters (move throttle, leg count, walk cursor), advance the
  // AI sub-state so the flight handler runs next frame, and set the signed heading from the direction bit.
  mem8[obj + OBJ_MOVE_THROTTLE] = 3;
  mem8[obj + OBJ_LEG_COUNT] = 12;
  mem8[obj + OBJ_WALK_CURSOR] = 0;
  mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 1;
  mem8[obj + OBJ_HEADING] = (mem8[obj + OBJ_DIRECTION] & 1) ? -12 : 12; // byte store wraps -12 -> 244
}
