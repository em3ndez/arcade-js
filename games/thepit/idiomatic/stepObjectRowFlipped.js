// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectRowFlipped — step the tracked object the opposite way along its move axis: derive its
 * tile row and route on it, firing the dig one-shot at the boundary row.
 *
 * One arm of the at-rest object dispatcher, and the mirror of the axis sibling stepObjectRowUnflipped:
 * same derive-a-row-then-route shape, but stepping the other way with the boundary at the far end. If
 * the object's frame is held off, the move is skipped and only its sprite-deferral record rebuilt.
 * Otherwise it forces the object's sprite code, turns its position minus the offset into a tile row,
 * and routes on it — usually through locateObjectCellCheckGoal, but the boundary row with the feature
 * latch pending fires a one-shot that consumes the latch and builds the dig object instead.
 */

import { PLAYER_Y, PLAYER_FACING, PLAYER_TILE_ROW, PRIZE_GATE, HAZARD_ACTIVE_COUNT, HAZARD_STATE, CARVE_SEAM_LEFT } from "./names.js";
import { u8 } from "../../../core/int.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { locateObjectCellCheckGoal } from "./locateObjectCellCheckGoal.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

const STEP_SPRITE = 178; // sprite code forced for the object before this step
const TOP_ROW = 31; // the top tile row of the map; rows are counted down from here
const POSITION_BIAS = 3; // rounding bias folded into the position before it reduces to a tile row
const BOUNDARY_ROW = 22; // reaching this row with the feature latch pending fires the dig one-shot
const DIG_TARGET_STATE = 9; // the dig object's "done/target" phase the one-shot arms it to

export function stepObjectRowFlipped(m, offset = m.regs.e) {
  const { mem8 } = m;

  // Deferred: frame held off, so skip the move and just rebuild the sprite-deferral record.
  if (mem8[CARVE_SEAM_LEFT] !== 0) return stageObjectSpriteRecord(m);

  mem8[PLAYER_FACING] = STEP_SPRITE;

  // Tile row under the object: bias its position by minus the offset plus a rounding constant
  // (wrapping within a byte), then count rows down from the top, one row per eight pixels.
  const row = TOP_ROW - (u8(mem8[PLAYER_Y] - offset + POSITION_BIAS) >> 3);
  mem8[PLAYER_TILE_ROW] = row;

  // Off the boundary row, or on it without the latch pending, keep positioning through the front.
  if (row !== BOUNDARY_ROW || mem8[PRIZE_GATE] === 0) {
    return locateObjectCellCheckGoal(m, row);
  }

  mem8[PRIZE_GATE] = 0;
  mem8[HAZARD_ACTIVE_COUNT] = 0;
  mem8[HAZARD_STATE] = DIG_TARGET_STATE;
  return stageDigObjectSpriteRecord(m);
}
