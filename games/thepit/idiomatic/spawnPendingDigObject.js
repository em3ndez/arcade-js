// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnPendingDigObject — pop a random queued column and spawn a dig object there.
 *
 * A queue of up to 24 columns waiting to spawn lives in work memory (12 left-of-centre
 * columns paired one-for-one with 12 right-of-centre ones). This dequeues one at random
 * and brings a new dig object into the maze at that column:
 *   - raise the spawn-active flag and play the spawn sound;
 *   - seed the dig object's staging bytes — its spawn-phase code, colour attribute, and
 *     lifetime timer (copied from the reload byte);
 *   - draw random queue slots until one holds a column, remove it from the queue, and —
 *     for a left-half column — switch to its paired right-half column when that is queued;
 *   - turn the chosen column into a tilemap cell, paint the spawn tile, record player overlap;
 *   - hand off to the dig-object sprite-record builder to finish the spawn.
 * The overlap flag it publishes lets the follow-on reaction know the spawn appeared on the
 * player. The queue's exact contents and the spawn tile's meaning are not fully pinned.
 */

import { advanceRandom } from "./advanceRandom.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { requestSound18 } from "./requestSound18.js";
import { HAZARD_ACTIVE_COUNT, HAZARD_STATE, HAZARD_TYPE, DIG_OBJ_TIMER, DIG_OBJ_TIMER_RELOAD, HAZARD_X, HAZARD_Y, PLAYER_Y, PLAYER_X, MOVE_BLOCK_FLAG, DROP_QUEUE, VIDEO_RAM_BASE } from "./names.js";
import { u8 } from "../../../core/int.js";

// The tile code painted into the spawned cell.
const SPAWN_TILE = 37;
// Tilemap RAM base; the row is inverted (top of the map is the highest row index).

export function spawnPendingDigObject(m) {
  const { mem8 } = m;

  // Begin a spawn: raise the active flag, play the spawn sound, seed the staging bytes.
  mem8[HAZARD_ACTIVE_COUNT] = 1;
  requestSound18(m);
  mem8[HAZARD_STATE] = 16; // spawn-phase code
  mem8[HAZARD_TYPE] = 6; // colour attribute
  mem8[DIG_OBJ_TIMER] = mem8[DIG_OBJ_TIMER_RELOAD]; // lifetime for the new object

  // Draw slots (low 5 bits) until one holds a column, rejecting 24..31 for a uniform pick.
  let slot;
  do {
    slot = advanceRandom(m) & 0x1f;
  } while (slot >= 24 || mem8[DROP_QUEUE + slot] === 0);

  // Chosen column and its slot value; a left-half column switches to its paired right when queued.
  let column = slot;
  let value = mem8[DROP_QUEUE + slot];
  if (slot < 12) {
    const pairedValue = mem8[DROP_QUEUE + slot + 12];
    if (pairedValue !== 0) {
      column = slot + 12;
      value = pairedValue;
    }
  }

  // Dequeue and turn into a cell coordinate: one axis from the value, one a fixed column base.
  mem8[DROP_QUEUE + column] = 0;
  mem8[HAZARD_X] = value + 1;
  mem8[HAZARD_Y] = column < 12 ? 183 : 191; // left vs right column-base coordinate

  // Paint the spawn tile into the tilemap cell those coordinates map to.
  const targetX = mem8[HAZARD_X];
  const targetY = mem8[HAZARD_Y];
  const invertedRow = 31 - (targetX >> 3);
  const cellColumn = (targetY + 1) >> 3;
  mem8[VIDEO_RAM_BASE + invertedRow * 32 + cellColumn - 31] = SPAWN_TILE;

  // Flag whether the new cell lands on the tracked player: same band, player in an 8px window ahead.
  let landsOnPlayer = 0;
  if (targetY + 12 === mem8[PLAYER_X]) {
    const playerX = mem8[PLAYER_Y];
    if (targetX < playerX && u8(targetX + 8) >= playerX) landsOnPlayer = 1;
  }
  mem8[MOVE_BLOCK_FLAG] = landsOnPlayer;

  // Finish the spawn: build the dig-object sprite record, whose return unwinds to our caller.
  return stageDigObjectSpriteRecord(m);
}
