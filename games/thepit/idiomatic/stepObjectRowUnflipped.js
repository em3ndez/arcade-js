// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectRowUnflipped — advance the tracked object one row-axis step: derive its tile row, route on it, and fire the dig one-shot at the trigger row.
 *
 * Reached from the per-frame object dispatch when the move command selects the row axis,
 * handed the caller's per-frame position offset. Three outcomes: DEFERRED — the frame is
 * held off (overlap flag set), so skip the move and rebuild only the sprite-deferral record.
 * COMMON STEP — pre-load the sprite code, reduce position + offset to a tile row (counted up
 * from the map bottom, one row per eight pixels), then hand off to the horizontal-step router.
 * DIG ONE-SHOT — at the trigger row with the feature latch pending. Every exit tail-calls a
 * memory-only router/builder, so no register is left live.
 */

import { PLAYER_Y, PLAYER_FACING, PLAYER_TILE_ROW, PRIZE_GATE, HAZARD_ACTIVE_COUNT, HAZARD_STATE, CARVE_SEAM_RIGHT } from "./names.js";
import { u8 } from "../../../core/int.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { locateActorCellCheckGoal } from "./locateActorCellCheckGoal.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

const DEFAULT_SPRITE = 0x32; // sprite code pre-loaded for the object before this step
const BOTTOM_ROW = 31; // the bottom tile row of the map; rows are counted up from here
const POSITION_BIAS = 11;
const TRIGGER_ROW = 7; // reaching this row with the feature latch pending fires the dig one-shot
const DIG_TARGET_STATE = 9; // the dig object's "done/target" phase the one-shot arms it to

export function stepObjectRowUnflipped(m, offset = m.regs.e) {
  const { mem8 } = m;

  // Deferred: the frame is held off, so skip the move and rebuild the deferral record.
  if (mem8[CARVE_SEAM_RIGHT] !== 0) return stageObjectSpriteRecord(m);

  // Pre-load the object's sprite code for this step.
  mem8[PLAYER_FACING] = DEFAULT_SPRITE;

  // Tile row: bias position by offset + a rounding constant (wraps in a byte), count up from the bottom.
  const rowIndex = BOTTOM_ROW - (u8(mem8[PLAYER_Y] + offset + POSITION_BIAS) >> 3);
  mem8[PLAYER_TILE_ROW] = rowIndex;

  // Otherwise continue the step through the horizontal-step router (which reads the row).
  if (rowIndex !== TRIGGER_ROW || mem8[PRIZE_GATE] === 0) {
    return locateActorCellCheckGoal(m, rowIndex);
  }

  // Trigger row with the latch pending: consume the latch, clear the spawn, arm the dig phase.
  mem8[PRIZE_GATE] = 0;
  mem8[HAZARD_ACTIVE_COUNT] = 0;
  mem8[HAZARD_STATE] = DIG_TARGET_STATE;
  return stageDigObjectSpriteRecord(m);
}
