// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_29, SAVED_INDEX, loc_2a, loc_2b, COORD_LIST_PTR_HI, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, SCRIPT_WALK_CONTINUE, SCRIPT_CURSOR,
  TUBE_GEOM_FLAG, PLAYER_SHOT_DEPTH, ENEMY_SLOT_FLAGS, ENEMY_SLOT_DIR, ENEMY_SEGMENT, ENEMY_DEPTH, LANE_ENEMY_COUNT_0,
} from "./names.js";
import { loc_9b07 } from "./loc_9b07.js";
import { loc_994d } from "./loc_994d.js";

// Retire the enemy in slot Y: clear its active-table entry ENEMY_DEPTH,y and adjust an active-count
// cell -- when the slot value matches PLAYER_SHOT_DEPTH and the slot's lane (ENEMY_SLOT_FLAGS,y & 7) is not 4 the
// per-type counter ENEMY_TYPE_COUNT drops, otherwise the total ENEMY_TOTAL_COUNT drops -- then drop the per-lane
// counter LANE_ENEMY_COUNT_0 at that lane (X is parked in SAVED_INDEX and restored, so exit X == entry X). When
// (ENEMY_SLOT_DIR,y & 3) is set, seat the draw cells loc_2b/loc_2a and spawn a replacement via the
// list-setup and draw handlers, and if that spawn took, spawn a second mirrored one.
export function loc_a06f(m, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;

  const slotVal = mem8[u16(ENEMY_DEPTH + y)];
  mem8[loc_29] = slotVal;
  let decTotal = true;
  if (slotVal === mem8[PLAYER_SHOT_DEPTH] && (mem8[u16(ENEMY_SLOT_FLAGS + y)] & 0x07) !== 0x04) {
    mem8[ENEMY_TYPE_COUNT] = mem8[ENEMY_TYPE_COUNT] - 1;
    decTotal = false;
  }
  if (decTotal) mem8[ENEMY_TOTAL_COUNT] = mem8[ENEMY_TOTAL_COUNT] - 1;

  mem8[u16(ENEMY_DEPTH + y)] = 0x00;

  const lane = mem8[u16(ENEMY_SLOT_FLAGS + y)] & 0x07;
  mem8[SAVED_INDEX] = x; // park caller X; it is reloaded below, so exit X == entry X
  mem8[u16(LANE_ENEMY_COUNT_0 + lane)] = mem8[u16(LANE_ENEMY_COUNT_0 + lane)] - 1;

  const gate = mem8[u16(ENEMY_SLOT_DIR + y)] & 0x03;
  if (gate === 0) return (m.regs.a = gate); // A live-out is the anded gate value (0)

  // Seat loc_2b from the gate: g-1, except g==3 wraps to 4.
  const g1 = gate - 1;
  mem8[loc_2b] = g1 === 0x02 ? 0x04 : g1;

  // Seat loc_2a from (ENEMY_SEGMENT,y - 1) & 0x0f, snapping 0x0f to 0 when TUBE_GEOM_FLAG bit7 is set.
  let seat = (mem8[u16(ENEMY_SEGMENT + y)] - 1) & 0x0f;
  if (seat === 0x0f && mem8[TUBE_GEOM_FLAG] & 0x80) seat = 0x00;
  mem8[loc_2a] = seat;

  // First draw: build the coordinate list, seed the lane counters, spawn.
  loc_9b07(m, y, x); // slot x threaded on to the list-setup dispatch that reads it
  mem8[SCRIPT_CURSOR] = mem8[COORD_LIST_PTR_HI];
  mem8[SCRIPT_CURSOR] = mem8[SCRIPT_CURSOR] - 1;
  mem8[SCRIPT_WALK_CONTINUE] = 0x00;
  const spawned = loc_994d(m, y, x); // slot x threaded on to the spawn step that stashes it
  if (spawned === 0x00) return (m.regs.a = spawned); // no free slot -> done (A live-out is 0)

  // Second draw: advance loc_2a by 2 (snap 0x0f -> 0x0e on TUBE_GEOM_FLAG bit7), set loc_2b bit6, spawn.
  let seat2 = (mem8[loc_2a] + 0x02) & 0x0f;
  if (seat2 === 0x0f && mem8[TUBE_GEOM_FLAG] & 0x80) seat2 = 0x0e;
  mem8[loc_2a] = seat2;
  mem8[loc_2b] = mem8[loc_2b] | 0x40;
  return loc_994d(m, y, x); // the final draw sets the A live-out
}
