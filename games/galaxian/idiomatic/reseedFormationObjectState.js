// SPDX-License-Identifier: GPL-3.0-only
import { advanceRandomSeed } from "./advanceRandomSeed.js";
import {
  OBJ_ACTIVE_FLAG,
  loc_4224,
  loc_4221,
  loc_421e,
  ACTIVE_NEIGHBOR_COUNT,
} from "./names.js";

/**
 * reseedFormationObjectState (ROM 0x0e99) -- object-AI state handler for state 5, the "re-launch an
 * attacker from the left edge" state in the sixteen-entry object-AI table dispatched off 0x0ce6.
 *
 * WHAT IT IS
 *   Each of the eight object records runs a small state machine keyed on its state byte (record+2); this
 *   is the handler for state 5. It re-initialises a swooping attacker so it comes around again: it parks
 *   the sprite back at the left edge, zeroes its heading, and ticks its leg counter. Then, on the normal
 *   path, when the field is active and an activity gate is open, it rolls a fresh random screen Y and
 *   advances the object's state so it re-enters flight. A special packed-cell value (record+7 high bits
 *   all set) diverts it into the formation-drain path instead: while active neighbours remain it recounts
 *   them and still reseeds, but once none are left it deactivates this object and ramps a slow phase /
 *   difficulty counter toward its ceiling. See mechanisms.md "The object-AI driver and its state handlers".
 *
 * ROLE IN THE MACHINE
 *   Called by driveObjectSlot for an active record whose state index is 5. Operates on the 32-byte object
 *   record pointed to by IX. Reads/writes fields within that record (see the offset table below) and
 *   touches four machine cells: OBJ_ACTIVE_FLAG (0x4200, the object-subsystem enable) and the activity
 *   gates loc_4224 / loc_4221 (region-empty summaries) decide whether to reseed; ACTIVE_NEIGHBOR_COUNT
 *   (0x422a) carries the live-neighbour tally between passes; loc_421e is the phase counter clamped to 2.
 *   The random Y comes from advanceRandomSeed, the shared LFSR.
 *
 * Grounding: [seen] (names.js cert for 0x0e99).
 *
 * LIVE-OUT: this record's X/heading/leg counter always updated; on the reseed path its Y, hold timer, and
 *   state advance; on the drain path its active flag clears and loc_421e ramps; ACTIVE_NEIGHBOR_COUNT may
 *   be recounted.
 */

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

  // Common re-init done on every entry: snap the sprite X back to the left edge (8), tick the leg
  // counter that paces the attacker's motion legs, and zero the signed heading so it faces straight.
  mem8[obj + X_FIELD] = 8;
  mem8[obj + LEG_COUNTER] = mem8[obj + LEG_COUNTER] + 1;
  mem8[obj + HEADING] = 0;

  // Normal path: the packed grid-cell (record+7) does NOT have all three high bits (0x70) set, so this is
  // an ordinary re-launch -- reseed its Y and advance the state.
  if ((mem8[obj + GRID_CELL] & 0x70) !== 0x70) {
    return reseedAndAdvance(m, obj);
  }

  // High cell bits set: while neighbors remain, recount them and take the reseed path; once none are
  // left, deactivate this object and ramp the phase counter toward its ceiling.
  if (mem8[ACTIVE_NEIGHBOR_COUNT] !== 0) {
    recountNeighbors(m, obj);
    return reseedAndAdvance(m, obj);
  }
  // No neighbours left: retire this object (clear its active flag) and nudge the phase/difficulty counter
  // loc_421e up by one, saturating at PHASE_CEILING (2) -- the 0xff mask matches the 8-bit wrap the Z80 add.
  mem8[obj + ACTIVE] = 0;
  mem8[loc_421e] = Math.min((mem8[loc_421e] + 1) & 0xff, PHASE_CEILING);
}

// Roll a new random Y and advance the state twice, but only when enabled and an activity gate is
// open; otherwise just advance the state once.
function reseedAndAdvance(m, obj) {
  const { mem8 } = m;

  // Gate the reseed on the object subsystem being switched on (OBJ_ACTIVE_FLAG bit0) AND at least one
  // activity gate open (loc_4224 or loc_4221 -- the region-empty summaries that mark live play).
  const enabled = mem8[OBJ_ACTIVE_FLAG] & 1;
  const gateOpen = mem8[loc_4224] !== 0 || mem8[loc_4221] !== 0;
  if (enabled && gateOpen) {
    // Fresh random screen Y: take five bits of the shared LFSR (0..31), halve the old Y and add the roll
    // plus a 32-pixel floor so the object re-enters somewhere down the screen. Arm the hold timer (40) and
    // advance the state a first time (this branch bumps the state twice in total, the fall-through does one).
    const roll = advanceRandomSeed(m) & 0x1f;
    mem8[obj + Y_FIELD] = (mem8[obj + Y_FIELD] >> 1) + roll + 32;
    mem8[obj + HOLD_TIMER] = 40;
    mem8[obj + STATE] = mem8[obj + STATE] + 1;
  }
  // Always advance the state once more, so a gated-off object still steps forward (single bump) while a
  // reseeded one steps twice.
  mem8[obj + STATE] = mem8[obj + STATE] + 1;
}

// Count how many of the two following object records are active and publish that tally.
function recountNeighbors(m, obj) {
  const { mem8 } = m;
  // The two records that follow this one in the array sit at +32 and +64 bytes; test each one's active
  // bit0 and store the 0..2 total in ACTIVE_NEIGHBOR_COUNT so the drain check above stays current.
  let count = 0;
  if (mem8[obj + NEIGHBOR_1] & 1) count++;
  if (mem8[obj + NEIGHBOR_2] & 1) count++;
  mem8[ACTIVE_NEIGHBOR_COUNT] = count;
}
