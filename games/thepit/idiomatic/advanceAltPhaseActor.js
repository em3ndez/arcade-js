// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAltPhaseActor — per-frame animate + march step for an active object.
 *
 * Runs once a frame for an object that is already alive (its caller tail-jumps here when the
 * object's spawn flag is set). It ticks a cadence timer, flipping the walk-cycle tile between two
 * frames on underflow; gates movement so only every 4th tick moves the object (the others just
 * rebuild its sprite records and exit); and on a move tick marches the object right along its
 * travel row (the shadow trailing 16 columns), latches its arrival and builds a probe record at
 * the far column, then descends one row per move tick to the floor, where it idles — waiting
 * while the hold timer runs, else re-arming the 120-frame hold and resetting to the idle tile. A
 * sibling of the object-movement family; the exact object it drives is not pinned.
 */

import {
  ENEMY3_TIMER, ENEMY3_TILE, ENEMY3_X, ENEMY3_Y,
  ENEMY3_TWIN_X, ENEMY3_TWIN_TILE, ENEMY3_TWIN_Y, PLAYER_Y,
  PLAYER_ACTIVE, TRANSITION_TIMER, POST_TRANSITION_MODE,
} from "./names.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

const WALK_TILE_A = 46; // the two frames of the walk-cycle animation
const WALK_TILE_B = 175;
const IDLE_TILE = 9; // tile shown once the object settles at the floor
const CADENCE = 8; // frames between walk-tile flips
const FLOOR_HOLD_FRAMES = 120; // how long the object idles at the floor
const TRAVEL_ROW = 23; // Y at or above which the object is still marching, not descending
const FAR_COLUMN = 36; // X the march stops at, where the descent begins
const SHADOW_X_OFFSET = 16; // the shadow sprite trails the object by this many columns

export function advanceAltPhaseActor(m) {
  const { mem8 } = m;

  // 1. Cadence tick — count the frame timer down (wrapping at 0), and on underflow
  //    reload it and flip to the other walk tile.
  mem8[ENEMY3_TIMER] = mem8[ENEMY3_TIMER] - 1;
  let timer = mem8[ENEMY3_TIMER];
  if (timer === 0) {
    timer = CADENCE;
    mem8[ENEMY3_TIMER] = CADENCE;
    const next = mem8[ENEMY3_TILE] === WALK_TILE_A ? WALK_TILE_B : WALK_TILE_A;
    mem8[ENEMY3_TILE] = next;
    mem8[ENEMY3_TWIN_TILE] = next ^ 1; // shadow shows the paired tile (bit 0 flipped)
  }

  // 2. Move gate — only every 4th tick moves; otherwise just rebuild the sprite records.
  if (timer % 4 !== 0) return stageActorSpriteRecords(m);

  // 3a. March across the travel row.
  const y = mem8[ENEMY3_Y];
  if (y >= TRAVEL_ROW) {
    const x = mem8[ENEMY3_X];
    if (x < FAR_COLUMN) {
      // Step right one column; the shadow trails 16 columns behind.
      mem8[ENEMY3_X] = x + 1;
      mem8[ENEMY3_TWIN_X] = mem8[ENEMY3_X] + SHADOW_X_OFFSET;
      return stageActorSpriteRecords(m);
    }
    if (y === TRAVEL_ROW) {
      // Reached the far column on the travel row: latch the arrival and build the probe
      // record before the descent begins.
      mem8[PLAYER_ACTIVE] = 0;
      mem8[PLAYER_Y] = 0;
      mem8[POST_TRANSITION_MODE] = 1;
      // Build the object's deferral/probe record before the descent begins.
      stageObjectSpriteRecord(m);
    }
    // y above the travel row (or just latched): fall into the descent.
  }

  // 3b. Descend toward the floor, or idle once there.
  const row = mem8[ENEMY3_Y];
  if (row !== 0) {
    // Step down one row; mirror to the shadow.
    const nextRow = row - 1;
    mem8[ENEMY3_Y] = nextRow;
    mem8[ENEMY3_TWIN_Y] = nextRow;
    return stageActorSpriteRecords(m);
  }

  // At the floor. While the hold timer is still running, just wait.
  if (mem8[TRANSITION_TIMER] !== 0) return;

  // Hold elapsed: re-arm it and drop the object to its idle tile.
  mem8[TRANSITION_TIMER] = FLOOR_HOLD_FRAMES;
  mem8[ENEMY3_TILE] = IDLE_TILE;
  mem8[ENEMY3_TWIN_TILE] = IDLE_TILE;
  return stageActorSpriteRecords(m);
}
