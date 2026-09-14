// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_29, SAVED_INDEX, loc_2a, loc_2b, COORD_LIST_PTR_HI, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, SCRIPT_WALK_CONTINUE, SCRIPT_CURSOR,
  TUBE_GEOM_FLAG, PLAYER_SHOT_DEPTH, ENEMY_SLOT_FLAGS, ENEMY_SLOT_DIR, ENEMY_SEGMENT, ENEMY_DEPTH, LANE_ENEMY_COUNT_0,
} from "./names.js";
import { setupEnemyCoordList } from "./setupEnemyCoordList.js";
import { spawnClimberInFreeSlot } from "./spawnClimberInFreeSlot.js";

/**
 * retireEnemyAndSpawnSplit -- retire an enemy slot and, if armed, spawn its split replacements. ROM 0xa06f.
 *
 * Role in the machine: removing an enemy is more than clearing a cell -- the game tracks per-type and
 * total live counts, a per-lane occupancy, and, for enemies that split (fuseballs/flippers dropping
 * offspring), it may seat one or two fresh climbers on adjacent tube segments. This routine does all of
 * that bookkeeping when a slot dies. It is called from the retire/spawn glue (respawnEnemyAndAward,
 * spawnLaneEnemyAndAward) and from the depth-stepper 0x9c63.
 *
 * Behavior: read the slot's depth ENEMY_DEPTH,y ($2df,y) into scratch loc_29. Decide which live counter
 * to decrement: if the depth equals PLAYER_SHOT_DEPTH ($202) AND the lane (ENEMY_SLOT_FLAGS,y & 7) is not 4,
 * drop the per-type counter ENEMY_TYPE_COUNT ($109) and skip the total; otherwise drop the total
 * ENEMY_TOTAL_COUNT ($108). Zero ENEMY_DEPTH,y. Park caller X in SAVED_INDEX and drop the per-lane counter
 * LANE_ENEMY_COUNT_0+lane ($142). Read the split gate (ENEMY_SLOT_DIR,y & 3); if 0, return with A = 0.
 * Otherwise seat the two draw cells: loc_2b from the gate (g-1, but g==3 -> 4), and loc_2a from
 * (ENEMY_SEGMENT,y - 1) & 0x0f, snapping 0x0f -> 0 when TUBE_GEOM_FLAG bit7 is set (open vs closed tube).
 * Build the coordinate list (setupEnemyCoordList), seed the script cursor SCRIPT_CURSOR from
 * COORD_LIST_PTR_HI - 1, clear SCRIPT_WALK_CONTINUE, and spawn via spawnClimberInFreeSlot. If that spawn
 * took, seat a mirrored second one: loc_2a += 2 (snap 0x0f -> 0x0e on TUBE_GEOM_FLAG bit7), set loc_2b bit6,
 * and spawn again. X is reloaded from SAVED_INDEX inside the sub-chain, so exit X == entry X.
 *
 * Live-out: ENEMY_DEPTH,y cleared; one of ENEMY_TYPE_COUNT/ENEMY_TOTAL_COUNT and LANE_ENEMY_COUNT_0+lane
 * decremented; on a split, up to two new climbers seated; A = the anded gate (0) or the final spawn result.
 * Grounding: seen.
 */
export function retireEnemyAndSpawnSplit(m, y = m.regs.y, x = m.regs.x) {
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
  setupEnemyCoordList(m, y, x); // slot x threaded on to the list-setup dispatch that reads it
  mem8[SCRIPT_CURSOR] = mem8[COORD_LIST_PTR_HI];
  mem8[SCRIPT_CURSOR] = mem8[SCRIPT_CURSOR] - 1;
  mem8[SCRIPT_WALK_CONTINUE] = 0x00;
  const spawned = spawnClimberInFreeSlot(m, y, x); // slot x threaded on to the spawn step that stashes it
  if (spawned === 0x00) return (m.regs.a = spawned); // no free slot -> done (A live-out is 0)

  // Second draw: advance loc_2a by 2 (snap 0x0f -> 0x0e on TUBE_GEOM_FLAG bit7), set loc_2b bit6, spawn.
  let seat2 = (mem8[loc_2a] + 0x02) & 0x0f;
  if (seat2 === 0x0f && mem8[TUBE_GEOM_FLAG] & 0x80) seat2 = 0x0e;
  mem8[loc_2a] = seat2;
  mem8[loc_2b] = mem8[loc_2b] | 0x40;
  return spawnClimberInFreeSlot(m, y, x); // the final draw sets the A live-out
}
