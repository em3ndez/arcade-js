// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectAndResolveTile — step the tracked object one frame along its climb axis and resolve the
 * tile it lands on: collect loot, carve into terrain, block, or keep moving.
 *
 * The vertical-move counterpart of the object's horizontal walk-and-classify handler. It runs only
 * while the climb gate (MOVE_BLOCK_FLAG) is clear, else defers the frame, and folds three jobs into
 * one: locate the object's tile cell, collect any loot there, and classify solid/diggable terrain.
 * It works out which map cell the object occupies (row/column geometry with the caller's column
 * bias), publishes the tile, then resolves it — collecting loot on a boundary crossing, blocking on
 * solid tiles, arming the carve reaction when a diggable tile no longer matches the terrain its
 * table expects, and otherwise advancing one step. Every outcome ends by building the deferral
 * record (stageObjectSpriteRecord), whose return unwinds to the caller. The climb axis is grounded:
 * the digger surfaces to WIN at the top rung (PLAYER_X == 0x23), fixing offset 3 as screen-vertical;
 * the name stays generic because the routine does more than climb.
 */

import {
  AHEAD_TILE_RAW,
  BOARD_END_PHASE,
  CRYSTAL_COUNT,
  CUR_TILE,
  DIAMOND_COUNT,
  EXPECTED_TILE,
  GOAL_TILE_LATCH,
  MOVE_BLOCK_FLAG,
  NEXT_TILE,
  PLAYER_CELL_PTR,
  PLAYER_FACING,
  PLAYER_STEP_X,
  PLAYER_TILE_COL,
  PLAYER_TILE_ROW,
  PLAYER_X,
  PLAYER_Y,
  REACTION_PERIOD,
  REACTION_STATE,
  REACTION_TIMER,
  TREASURE_COLLECTED,
  VERT_STEP_EXPECTED_TILE_TABLE,
  VERT_STEP_NEIGHBOUR_TILE_TABLE,
} from "./names.js";
import { u8 } from "../../../core/int.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { awardTenPoints } from "./awardTenPoints.js";
import { awardTwentyPoints } from "./awardTwentyPoints.js";

// Base of the on-screen tile map in video RAM; a cell is an offset from here.
const VRAM_BASE = 0x9000;

// Tables of the terrain a cell is expected to hold, one row per diggable tile code
// (113..157) and sub-cell phase (0..7): the current cell's table, then the neighbouring cell's.

const FIRST_LOOT_TALLY = CRYSTAL_COUNT; // times a 10-point pickup was collected
const SECOND_LOOT_TALLY = DIAMOND_COUNT; // times a 20-point pickup was collected
const SECOND_LOOT_LATCH = TREASURE_COLLECTED; // records the collected 20-point code; gates the top-rung flag

const STEP_DELTA = PLAYER_STEP_X; // how far the object moves along its column each step

const BLANK_TILE = 112; // stamped over a collected pickup
const TEN_POINT_LOOT = 58;
const TWENTY_POINT_LOOT_LO = 59;
const TWENTY_POINT_LOOT_HI = 61;
const WALK_FRAME_A = 180; // the two alternating walk-frame sprites
const WALK_FRAME_B = 52;
const CARVE_SPRITE = 246; // sprite/event frame shown while carving into terrain
const CARVE_REACTION = 4; // reaction-state selector for the carve reaction

const TOP_RUNG_COLUMN = 35; // column value with nothing to resolve (top of the run)
const CROSSING_POSITION = 83; // below this the object has retreated past the goal crossing
const DIGGABLE_LOW = 113; // first tile code of the diggable terrain band
const DIGGABLE_HIGH = 158; // one past the last reactive tile code (>= this is passable)

export function stepObjectAndResolveTile(m, columnBias = m.regs.d) {
  const { mem8, mem16 } = m;

  if (mem8[MOVE_BLOCK_FLAG] !== 0) return stageObjectSpriteRecord(m);

  // Default walk-frame sprite; the tile resolution below overrides it where needed.
  mem8[PLAYER_FACING] = WALK_FRAME_A;

  // Which map row: bias the vertical counter, drop to an 8-pixel cell, flip so screen-top is index 0..31.
  const row = 31 - (u8(mem8[PLAYER_Y] + 3) >> 3);
  mem8[PLAYER_TILE_ROW] = row;

  const objY = mem8[PLAYER_X];

  // Top-rung column (PLAYER_X == 0x23, the object surfacing UP): nothing to resolve. If a +20 diamond
  // was already collected (SECOND_LOOT_LATCH = TREASURE_COLLECTED), set the top-rung spawn flag
  // BOARD_END_PHASE = 1 — the observed LEVEL-COMPLETE trigger. Either way defer this frame.
  if (objY === TOP_RUNG_COLUMN) {
    if (mem8[SECOND_LOOT_LATCH] !== 0) mem8[BOARD_END_PHASE] = 1;
    return stageObjectSpriteRecord(m);
  }

  // Retreated below the crossing column: clear the goal-reached latch.
  if (objY < CROSSING_POSITION) mem8[GOAL_TILE_LATCH] = 0;

  // Position along the climb axis: both the column source and the sub-cell boundary phase.
  const positionAccumulator = u8(objY - columnBias + 5);
  const col = positionAccumulator >> 3;
  mem8[PLAYER_TILE_COL] = col;

  // Video-RAM address of the cell the object occupies (32 cells per row).
  const cellPtr = VRAM_BASE + row * 32 + col;
  mem16[PLAYER_CELL_PTR] = cellPtr;

  // Read and publish the tile under the object (two copies), and clear the next-tile slot.
  mem8[NEXT_TILE] = 0;
  const tile = mem8[cellPtr];
  mem8[CUR_TILE] = tile;
  mem8[EXPECTED_TILE] = tile;

  // Only act on the cell's contents right as the object crosses a cell boundary.
  const onCellBoundary = (positionAccumulator & 7) === 0;
  if (onCellBoundary) {
    if (tile === TEN_POINT_LOOT) {
      awardTenPoints(m);
      mem8[FIRST_LOOT_TALLY] = mem8[FIRST_LOOT_TALLY] + 1;
      mem8[cellPtr] = BLANK_TILE;
      return advanceStepAndStage(m);
    }
    if (tile >= TWENTY_POINT_LOOT_LO && tile <= TWENTY_POINT_LOOT_HI) {
      mem8[SECOND_LOOT_LATCH] = tile;
      awardTwentyPoints(m);
      mem8[SECOND_LOOT_TALLY] = mem8[SECOND_LOOT_TALLY] + 1;
      mem8[cellPtr] = BLANK_TILE;
      return advanceStepAndStage(m);
    }
  }

  // Tiles that always block: defer the frame, no move.
  if (tile === 42 || tile === 65 || tile === 193) return stageObjectSpriteRecord(m);

  // Two reactive bands are gated by the sub-cell phase's bit 2: a single special code (197) and
  // the 154..157 band read as blocking unless that bit is set.
  const phaseGateOpen = (positionAccumulator & 4) !== 0;
  if (tile === 197) {
    if (!phaseGateOpen) return stageObjectSpriteRecord(m);
    // gate open: 197 sits above the diggable band, handled as passable below
  } else if (tile >= 149 && tile <= 153) {
    return stageObjectSpriteRecord(m); // this mid band always blocks
  } else if (tile >= 154 && tile <= 157) {
    if (!phaseGateOpen) return stageObjectSpriteRecord(m);
  } else if (tile >= DIGGABLE_HIGH) {
    return advanceStepAndStage(m); // above every reactive band -> passable
  }

  // What remains is below the diggable band, or the gate-open 197 above it: passable.
  if (tile < DIGGABLE_LOW || tile >= DIGGABLE_HIGH) return advanceStepAndStage(m);

  // Diggable band: compare against the terrain this cell is expected to hold.
  const subCell = positionAccumulator & 7;
  const expected = mem8[VERT_STEP_EXPECTED_TILE_TABLE + (tile - DIGGABLE_LOW) * 8 + (7 - subCell)];
  mem8[EXPECTED_TILE] = expected;

  if (expected === tile) return advanceStepAndStage(m);

  // Mismatch: the object has run into fresh terrain — arm the carve reaction.
  mem8[REACTION_TIMER] = mem8[REACTION_PERIOD];
  mem8[REACTION_STATE] = CARVE_REACTION;
  mem8[PLAYER_FACING] = CARVE_SPRITE;

  // If the next sub-cell rolls onto a boundary there is no neighbour cell to sample.
  const nextSubCell = (positionAccumulator + 1) & 7;
  if (nextSubCell === 0) return stageObjectSpriteRecord(m);

  // Sample the neighbouring cell one step back; if it too is diggable, record the terrain its own
  // table expects there into the next-tile slot.
  const neighbourTile = mem8[cellPtr - 1];
  mem8[AHEAD_TILE_RAW] = neighbourTile;
  if (neighbourTile >= DIGGABLE_LOW && neighbourTile < DIGGABLE_HIGH) {
    mem8[NEXT_TILE] = mem8[VERT_STEP_NEIGHBOUR_TILE_TABLE + (neighbourTile - DIGGABLE_LOW) * 8 + nextSubCell];
  }
  return stageObjectSpriteRecord(m);
}

/** Advance the object one step down its column by the per-step delta, cycle its walk-frame sprite
 *  on the stepped position's bit 1, then build the deferral record. The record's own return
 *  unwinds to stepObjectAndResolveTile's caller, so this is the "keep moving" return. */
function advanceStepAndStage(m) {
  const { mem8 } = m;
  const stepped = mem8[PLAYER_X] - mem8[STEP_DELTA];
  mem8[PLAYER_X] = stepped;
  mem8[PLAYER_FACING] = (stepped & 2) === 0 ? WALK_FRAME_A : WALK_FRAME_B;
  return stageObjectSpriteRecord(m);
}
