// SPDX-License-Identifier: GPL-3.0-only
// Object spawn/init (dispatch state 0): raise the spawn flag, derive the sprite position from the packed
// grid cell, and enqueue the object's spawn command. Look up its sprite# and flight-curve seed from the
// per-row record table; the top row also tallies its two active neighbour slots. Both paths seed the
// motion counters, advance the sub-state, and pick the heading sign from the direction bit.
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

const TOP_ROW_INDEX = 14; // record index (row*2) when the grid-cell row bits are all set

export function initSpawnedObjectFromGridCell(m, obj = m.regs.ix) {
  const { mem8 } = m;

  mem8[obj + OBJ_STEP_TIMER] = 0;
  mem8[loc_41c2] = 1; // raise the spawn flag

  positionObjectFromGridCell(m, obj);

  const cell = mem8[obj + OBJ_GRID_CELL];
  enqueueCommandWord(m, (1 << 8) | cell); // spawn command word: type 1, grid cell

  // Row bits (grid-cell bits 4-6) index a 2-byte {sprite#, curve seed} record.
  const recordIndex = (cell & 0x70) >> 3;
  mem8[obj + OBJ_SPRITE_NO] = mem8[SPAWN_RECORD_TABLE + recordIndex];
  mem8[obj + OBJ_CURVE_SEED] = mem8[SPAWN_RECORD_TABLE + recordIndex + 1];

  if (recordIndex === TOP_ROW_INDEX) {
    mem8[obj + OBJ_ATTR_BASE] = 24;
    let neighbours = 0;
    if (mem8[obj + OBJ_NEXT_ACTIVE] & 1) neighbours++;
    if (mem8[obj + OBJ_SECOND_ACTIVE] & 1) neighbours++;
    mem8[ACTIVE_NEIGHBOR_COUNT] = neighbours;
  } else {
    mem8[obj + OBJ_ATTR_BASE] = 0;
  }

  // Shared tail: seed the motion counters, advance the sub-state, set the heading sign.
  mem8[obj + OBJ_MOVE_THROTTLE] = 3;
  mem8[obj + OBJ_LEG_COUNT] = 12;
  mem8[obj + OBJ_WALK_CURSOR] = 0;
  mem8[obj + OBJ_STATE] = mem8[obj + OBJ_STATE] + 1;
  mem8[obj + OBJ_HEADING] = (mem8[obj + OBJ_DIRECTION] & 1) ? -12 : 12; // byte store wraps -12 -> 244
}
