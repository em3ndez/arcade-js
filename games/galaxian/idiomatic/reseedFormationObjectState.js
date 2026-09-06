// SPDX-License-Identifier: GPL-3.0-only
// Formation-object state handler: re-init the record's X and heading and tick its leg counter, then
// either roll a fresh random Y and advance the dispatch state (activity-gated), or -- when the packed
// cell's high bits are all set -- recount active neighbors and reseed, else ramp a phase counter.
import { advanceRandomSeed } from "./advanceRandomSeed.js";
import {
  OBJ_ACTIVE_FLAG,
  loc_4224,
  loc_4221,
  loc_421e,
  ACTIVE_NEIGHBOR_COUNT,
} from "./names.js";

// Object-record field offsets.
const ACTIVE = 0;        // bit0: this object's active flag
const STATE = 2;         // dispatch/sub-state index
const X_FIELD = 3;
const Y_FIELD = 4;
const HEADING = 5;
const GRID_CELL = 7;     // packed cell; its high bits (0x70) select the branch
const HOLD_TIMER = 16;
const LEG_COUNTER = 23;
const NEIGHBOR_1 = 32;   // the two following object records' active flags
const NEIGHBOR_2 = 64;

const PHASE_CEILING = 2;

export function reseedFormationObjectState(m, obj = m.regs.ix) {
  const { mem8 } = m;

  mem8[obj + X_FIELD] = 8;
  mem8[obj + LEG_COUNTER] = mem8[obj + LEG_COUNTER] + 1;
  mem8[obj + HEADING] = 0;

  if ((mem8[obj + GRID_CELL] & 0x70) !== 0x70) {
    return reseedAndAdvance(m, obj);
  }

  // High cell bits set: while neighbors remain, recount them and take the reseed path; once none are
  // left, deactivate this object and ramp the phase counter toward its ceiling.
  if (mem8[ACTIVE_NEIGHBOR_COUNT] !== 0) {
    recountNeighbors(m, obj);
    return reseedAndAdvance(m, obj);
  }
  mem8[obj + ACTIVE] = 0;
  mem8[loc_421e] = Math.min((mem8[loc_421e] + 1) & 0xff, PHASE_CEILING);
}

// Roll a new random Y and advance the state twice, but only when enabled and an activity gate is
// open; otherwise just advance the state once.
function reseedAndAdvance(m, obj) {
  const { mem8 } = m;

  const enabled = mem8[OBJ_ACTIVE_FLAG] & 1;
  const gateOpen = mem8[loc_4224] !== 0 || mem8[loc_4221] !== 0;
  if (enabled && gateOpen) {
    const roll = advanceRandomSeed(m) & 0x1f;
    mem8[obj + Y_FIELD] = (mem8[obj + Y_FIELD] >> 1) + roll + 32;
    mem8[obj + HOLD_TIMER] = 40;
    mem8[obj + STATE] = mem8[obj + STATE] + 1;
  }
  mem8[obj + STATE] = mem8[obj + STATE] + 1;
}

// Count how many of the two following object records are active and publish that tally.
function recountNeighbors(m, obj) {
  const { mem8 } = m;
  let count = 0;
  if (mem8[obj + NEIGHBOR_1] & 1) count++;
  if (mem8[obj + NEIGHBOR_2] & 1) count++;
  mem8[ACTIVE_NEIGHBOR_COUNT] = count;
}
