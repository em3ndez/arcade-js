// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceDigCarveObject — per-frame driver for the dig/carve object that tunnels the maze.
 *
 * It clears the three overlap-seam flags, then decides what the object does this frame:
 *   - If the tracked object is aligned on a feature cell (both under-tile latches set): with no
 *     spawn active it starts the next queued spawn; otherwise, unless mid-carve, it hands the frame
 *     to the capture handler.
 *   - Otherwise it dispatches on the spawn counter: none pending -> the background update; a fresh
 *     target (counter 2) -> publish the object's vertical overlap with the staged target box; then
 *     in every carve case it runs the carve countdown.
 * The carve countdown (DIG_OBJ_TIMER) paces the tunnelling: while it runs it steps the dig position
 * and animation; when it expires it completes the column (re-seeding and re-arming) if armed, or —
 * idle/unarmed — probes whether the tracked object walked into the carve box (snapping it in) and
 * carves one tile: fold the dig row/column into a tilemap cell, classify the tile there, and stamp
 * the carved sprite / rewrite the tile / join the dug channel, decrementing the spawn counter until
 * the run is committed. Every exit hands off to another routine that returns to this routine's caller.
 */

import { u8 } from "../../../core/int.js";
import {
  CARVE_CELL_PTR,
  CARVE_SEAM_LEFT,
  CARVE_SEAM_RIGHT,
  DIG_CARVE_REMAP_TABLE,
  DIG_COLLISION_STATE,
  DIG_OBJ_SUBTYPE,
  DIG_OBJ_TIMER,
  HAZARD_ACTIVE_COUNT,
  HAZARD_STATE,
  HAZARD_X,
  HAZARD_Y,
  MOVE_BLOCK_FLAG,
  PLAYER_CELL_PTR,
  PLAYER_FACING,
  PLAYER_X,
  PLAYER_Y,
  PRIZE_GATE,
  STAGED_TARGET_X,
  STAGED_TARGET_Y,
  TRANSITION_TIMER,
  TREASURE_COLLECTED,
} from "./names.js";
import { startNextDigSpawn } from "./startNextDigSpawn.js";
import { advanceChamberCreature } from "./advanceChamberCreature.js";
import { captureTargetOnOverlap } from "./captureTargetOnOverlap.js";
import { requestSound10 } from "./requestSound10.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { requestSound19 } from "./requestSound19.js";
import { commitDigEntity } from "./commitDigEntity.js";

// The dig object's state codes and the tile codes it stamps into the maze.
const CARVING_STATE = 48; // HAZARD_STATE while actively tunnelling
const DONE_STATE = 9; // HAZARD_STATE once the run is committed
const WALL_TILE = 193; // the carved channel wall / solid cap
const CHANNEL_TILE = 196; // the dug-channel edge sprite
const FILL_TILE = 112; // the blanked interior tile
const RETREAT_SPRITE = 55; // digging-up animation frame
const ADVANCE_SPRITE = 183; // same frame flipped for digging down (bit-7 flip set)
const COLUMN_HOLD_TIME = 180; // state-timer duration latched when a column completes
// TREASURE_COLLECTED is read here as a dig-spawn condition; whether that is a true coupling to the
// loot flag or a reuse of the byte is unproven. The feature-align latch role belongs to PRIZE_GATE.

export function advanceDigCarveObject(m) {
  const { mem8 } = m;

  // Fresh frame: no overlap seams until the carve below re-detects them.
  mem8[MOVE_BLOCK_FLAG] = 0;
  mem8[CARVE_SEAM_RIGHT] = 0;
  mem8[CARVE_SEAM_LEFT] = 0;

  // When the tracked object is aligned on a feature cell, either kick off the next
  // queued spawn (nothing spawning) or, unless the dig object is mid-carve, hand the
  // frame to the capture handler.
  if (mem8[TREASURE_COLLECTED] !== 0 && mem8[PRIZE_GATE] !== 0) {
    if (mem8[HAZARD_ACTIVE_COUNT] === 0) return startNextDigSpawn(m);
    if (mem8[HAZARD_STATE] !== CARVING_STATE) return captureTargetOnOverlap(m);
  }

  // Dispatch on the spawn counter.
  const spawn = mem8[HAZARD_ACTIVE_COUNT];
  if (spawn === 0) return advanceChamberCreature(m); // nothing to carve -> per-frame background update
  if (spawn === 2) {
    // A freshly staged target: publish whether the object vertically overlaps it.
    mem8[MOVE_BLOCK_FLAG] = boxOverlap(mem8[PLAYER_Y], mem8[PLAYER_X], mem8[STAGED_TARGET_X], mem8[STAGED_TARGET_Y]);
  }
  return runCarveTimer(m);
}

/**
 * Whether the tracked object at (objX,objY) sits in the target box: its row exactly one
 * tile (12) below the box's row, and its column inside an 8-wide band starting at the
 * box's even-aligned column. Returns 1 (overlap) or 0.
 */
function boxOverlap(objX, objY, boxCol, boxRow) {
  if (u8(boxRow + 12) !== objY) return 0;
  const left = boxCol & 0xfe; // align the band to an even pixel
  if (left >= objX) return 0;
  if (u8(left + 8) < objX) return 0;
  return 1;
}

/** Run the carve countdown: step the animation while it ticks, act on expiry. */
function runCarveTimer(m) {
  const { mem8 } = m;
  const timer = mem8[DIG_OBJ_TIMER];
  if (timer === 0) return armOrProbeCarve(m); // idle: probe / carve straight away

  const ticked = u8(timer - 1);
  mem8[DIG_OBJ_TIMER] = ticked;
  if (ticked !== 0) return stepCarveAnimation(m, ticked); // still running: animate

  // The countdown just expired: pull the dig row back one, then finalise.
  mem8[HAZARD_X] = u8(mem8[HAZARD_X] - 1);
  if (mem8[DIG_COLLISION_STATE] === 0) return armOrProbeCarve(m);
  return completeCarveColumn(m);
}

/**
 * The armed column finished: advance to the next column, re-seed the object's sprite
 * record and sound, clear the spawn counter, hold the object for a fixed time, and — for
 * the special sub-type — cap the two cells above the object's display cell.
 */
function completeCarveColumn(m) {
  const { mem8, mem16 } = m;
  mem8[HAZARD_Y] = u8(mem8[HAZARD_Y] + 8); // step to the next dig column
  requestSound10(m);
  mem8[PLAYER_FACING] = DONE_STATE;
  stageObjectSpriteRecord(m);
  mem8[HAZARD_ACTIVE_COUNT] = 0;
  mem8[TRANSITION_TIMER] = COLUMN_HOLD_TIME;
  if (mem8[DIG_OBJ_SUBTYPE] === 2) {
    const cell = mem16[PLAYER_CELL_PTR];
    mem8[cell - 2] = WALL_TILE;
    mem8[cell - 3] = FILL_TILE;
  }
  return stageDigObjectSpriteRecord(m);
}

/**
 * Pick the digging animation from the low bits of the countdown: every 8th tick retreat
 * the dig row (digging up), the 4-tick offset advance it (digging down), any other tick
 * just re-checks the overlap without moving.
 */
function stepCarveAnimation(m, ticked) {
  const { mem8 } = m;
  let stepSprite;
  if ((ticked & 7) === 0) {
    mem8[HAZARD_X] = u8(mem8[HAZARD_X] - 1);
    stepSprite = RETREAT_SPRITE;
  } else if ((ticked & 3) !== 0) {
    return recomputeOverlapAndStage(m); // mid-phase: no row change
  } else {
    mem8[HAZARD_X] = u8(mem8[HAZARD_X] + 1);
    stepSprite = ADVANCE_SPRITE;
  }
  return applyCarveStep(m, stepSprite);
}

/** When armed, publish the step's sprite frame (and cap the display cell for the special
 *  sub-type); then re-check the overlap and hand off. */
function applyCarveStep(m, stepSprite) {
  const { mem8, mem16 } = m;
  if (mem8[DIG_COLLISION_STATE] !== 0) {
    mem8[PLAYER_FACING] = stepSprite;
    if (mem8[DIG_OBJ_SUBTYPE] === 2) {
      mem8[mem16[PLAYER_CELL_PTR] - 3] = WALL_TILE;
    }
  }
  return recomputeOverlapAndStage(m);
}

/** Fold the live target box into the overlap flag (never clearing an existing overlap),
 *  then publish the dig-object sprite record. */
function recomputeOverlapAndStage(m) {
  const { mem8 } = m;
  let flag = mem8[MOVE_BLOCK_FLAG];
  if (boxOverlap(mem8[PLAYER_Y], mem8[PLAYER_X], mem8[HAZARD_X], mem8[HAZARD_Y])) flag = 1;
  mem8[MOVE_BLOCK_FLAG] = flag;
  return stageDigObjectSpriteRecord(m);
}

/**
 * Idle / unarmed frame. If the object is not yet armed and the tracked object has walked
 * into the carve box (11..13 rows below, an 11-wide column band), snap the object onto
 * the target's near edge, arm the dig object, and re-check the overlap. Otherwise probe
 * for a channel seam and carve.
 */
function armOrProbeCarve(m) {
  const { mem8 } = m;
  if (mem8[DIG_COLLISION_STATE] === 0) {
    const objX = mem8[PLAYER_Y];
    const objY = mem8[PLAYER_X];
    const targetX = mem8[HAZARD_X];
    const targetY = mem8[HAZARD_Y];
    const rowInBand = u8(targetY + 10) < objY && u8(targetY + 13) >= objY;
    const colInBand = u8(targetX - 3) < objX && u8(targetX + 8) >= objX;
    if (rowInBand && colInBand) {
      mem8[PLAYER_Y] = u8(targetX + 4); // snap onto the target's near edge
      mem8[DIG_COLLISION_STATE] = 1;
      return recomputeOverlapAndStage(m);
    }
  }
  return probeCarveBounds(m);
}

/**
 * Before carving, detect whether the new dig cell butts against the tracked object's
 * tile column and, if so, raise the left- or right-edge seam flag. Out of vertical range,
 * carve straight away.
 */
function probeCarveBounds(m) {
  const { mem8 } = m;
  const objY = mem8[PLAYER_X];
  const probeY = u8(mem8[HAZARD_Y] - 5);
  if (probeY >= objY) return carveTile(m); // above the object's row band
  if (probeY + 17 > 255) return carveTile(m); // wrapped past the band

  const alignedX = u8(mem8[PLAYER_Y] + 3) & 0xf8; // object's tile-column boundary (8px)
  const probeX = u8(mem8[HAZARD_X] - 1);
  if (probeX === alignedX) {
    mem8[CARVE_SEAM_RIGHT] = 1;
  } else if (u8(probeX + 16) === alignedX) {
    mem8[CARVE_SEAM_LEFT] = 1;
  }
  return carveTile(m);
}

/**
 * Carve one tile. Fold the dig row (HAZARD_X) and the just-advanced dig column (HAZARD_Y)
 * into a tilemap cell in video RAM, then classify the tile already sitting there:
 *   - already carved/solid tiles keep the wall tile;
 *   - a dug-channel edge (with the sub-column bit set) rewrites the tile to the wall;
 *   - a diggable tile is looked up in the dig-channel remap table and either kept, or
 *     rewritten, or (at the far sub-column) blanked;
 *   - anything else just publishes the record.
 */
function carveTile(m) {
  const { mem8, mem16 } = m;

  // Fold the dig position into a video-RAM cell: an inverted row and the advanced column.
  const rowTile = u8(31 - (u8(mem8[HAZARD_X] + 7) >> 3));
  const column = u8(mem8[HAZARD_Y] + 1);
  mem8[HAZARD_Y] = column; // advance the dig column
  const colByte = u8(column + 9);
  const colTile = colByte >> 3;
  const cellPtr = 0x9000 + rowTile * 32 + colTile; // VRAM base + row*32 + column
  mem16[CARVE_CELL_PTR] = cellPtr;

  const existing = mem8[cellPtr + 1];
  const subCol = colByte & 7;

  // Tiles that are already carved keep the wall tile and just re-stamp the sprite.
  if (existing === 42 || existing === 43 || existing === WALL_TILE || existing === 149) {
    return commitCarveCell(m, cellPtr, WALL_TILE, null);
  }
  // A dug-channel edge, on the sub-columns that face into it: rewrite it to the wall.
  if (existing === CHANNEL_TILE && (colByte & 4) !== 0) {
    return commitCarveCell(m, cellPtr, CHANNEL_TILE, WALL_TILE);
  }
  // Outside the diggable band there is nothing to carve — just publish the record.
  if (existing < 113 || existing >= 154) return stageDigObjectSpriteRecord(m);

  // Diggable band: look the tile up by (tile, sub-column) in the remap table.
  const remapped = mem8[DIG_CARVE_REMAP_TABLE + (existing - 113) * 8 + subCol];
  if (remapped !== 0) {
    if (subCol === 0) return commitCarveCell(m, cellPtr, WALL_TILE, null);
    return commitCarveCell(m, cellPtr, CHANNEL_TILE, remapped);
  }
  // No remap: only the far sub-column blanks the tile.
  if (subCol !== 7) return stageDigObjectSpriteRecord(m);
  mem8[cellPtr + 1] = FILL_TILE;
  return stageDigObjectSpriteRecord(m);
}

/**
 * Stamp the carved sprite into the cell (optionally rewriting the tile beside it), play
 * the carve sound, and decrement the spawn counter. While entities are still pending,
 * hand off to the entity commit; on the last one reset the dig row/state and (for the
 * special sub-type) cap the cell, then publish the sprite record.
 */
function commitCarveCell(m, cellPtr, spriteId, rewriteTile) {
  const { mem8 } = m;
  if (rewriteTile !== null) mem8[cellPtr + 1] = rewriteTile;
  mem8[cellPtr] = spriteId;
  requestSound19(m);

  const remaining = u8(mem8[HAZARD_ACTIVE_COUNT] - 1);
  mem8[HAZARD_ACTIVE_COUNT] = remaining;
  if (remaining !== 0) return commitDigEntity(m); // more entities in the run

  // Last entity committed: reset the dig row and mark the object done.
  mem8[HAZARD_X] = 0;
  mem8[HAZARD_STATE] = DONE_STATE;
  if (mem8[DIG_OBJ_SUBTYPE] === 2) mem8[cellPtr - 1] = WALL_TILE;
  return stageDigObjectSpriteRecord(m);
}
