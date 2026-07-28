// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceDigCarveObject — per-frame driver for the dig/carve object.  ROM 0x29ad.
 *
 * Runs once each frame for the object that tunnels the maze. It clears the three
 * overlap-seam flags, then decides what the object does this frame:
 *
 *   - If the tracked object is aligned on a feature cell (both under-tile latches set):
 *     with no spawn active it starts the next queued spawn; otherwise, unless the dig
 *     object is mid-carve, it hands the frame to the capture handler.
 *   - Otherwise it dispatches on the spawn counter: none pending -> the background
 *     update; a fresh target (counter 2) -> first publish the object's vertical overlap
 *     with the staged target box; then in every carve case it runs the carve countdown.
 *
 * The carve countdown (DIG_OBJ_TIMER) paces the tunnelling. While it runs it steps the
 * dig position and the digging animation. When it expires it either completes the column
 * (re-seeding the object and re-arming for the next dig) if the object is armed, or — idle
 * or unarmed — probes whether the tracked object has walked into the carve box (snapping
 * it in and arming) and then carves one tile: it folds the dig row/column into a tilemap
 * cell, classifies the tile already there, and stamps the carved sprite / rewrites the
 * tile / joins the dug channel, decrementing the spawn counter until the whole run is
 * committed.
 *
 * Every exit hands off to another routine (background update, spawn, capture, the entity
 * commit, or the dig-object sprite-record builder), each of which returns to this
 * routine's own caller.
 *
 * Name kept as advanceDigCarveObject: it is one of the dig-object family whose higher-level game role
 * stays best-effort (its siblings commitDigEntity / seedDigObjectBlock carry best-effort names for the same reason), and
 * it spans several distinct jobs (spawn gate, capture hand-off, carve timer, tile carving,
 * entity commit) that no single verb captures without over- or under-claiming.
 *
 * Memory-equivalent to the frozen oracle — equivalence-29ad.test.js.
 * GATE:     crafted-entry — dispatched every frame in attract (its natural inputs sit on
 *           the background arm), so the entry is captured live and the carve / commit /
 *           spawn / capture arms are driven by poking the decision bytes identically on
 *           both sides. RAM-only diff minus the dead stack scratch at the top of work RAM;
 *           pc/SP/value-registers are the dead Z80 trace (every hand-off is an idiomatic
 *           call that returns via plain JS, so a pc/SP contract would false-fail).
 * LIVE-OUT: memory-only — the overlap-seam flags, the dig-object record and dig position,
 *           the carved tilemap cells, plus whatever each delegated tail leaves. It reads
 *           every input from RAM and returns nothing a caller consumes.
 * NAMES:    DIG_OVERLAP_HOLD, FEATURE_TILE_LATCH, SPAWN_STATE, DIG_OBJ_STATE, DIG_OBJ_TIMER,
 *           DIG_OBJ_ARM_STATE, DIG_OBJ_SUBTYPE, OBJ_X, OBJ_Y, TARGET_X, TARGET_Y,
 *           STAGED_TARGET_X, STAGED_TARGET_Y, SPRITE_CODE, STATE_TIMER, ACTOR_CELL_PTR,
 *           CARVE_SEAM_LEFT (0x807e) / CARVE_SEAM_RIGHT (0x807f), TREASURE_COLLECTED (0x8078,
 *           read here as a dig-spawn condition — the shared treasure-collected byte, coupling
 *           vs reuse unproven) from ram.js. Kept hex: the live carve cursor 0x80af has no
 *           confirmed name yet.
 *
 * PURPOSE [guess]: dig-object's game role; TREASURE_COLLECTED (0x8078) read as spawn cond — coupling vs byte-reuse unproven.
 */

import { u8 } from "../../../core/int.js";
import {
  DIG_OVERLAP_HOLD,
  TREASURE_COLLECTED,
  FEATURE_TILE_LATCH,
  SPAWN_STATE,
  DIG_OBJ_STATE,
  DIG_OBJ_TIMER,
  DIG_OBJ_ARM_STATE,
  DIG_OBJ_SUBTYPE,
  OBJ_X,
  OBJ_Y,
  TARGET_X,
  TARGET_Y,
  STAGED_TARGET_X,
  STAGED_TARGET_Y,
  SPRITE_CODE,
  STATE_TIMER,
  ACTOR_CELL_PTR,
  CARVE_SEAM_LEFT,
  CARVE_SEAM_RIGHT,
} from "./ram.js";
import { startNextDigSpawn } from "./startNextDigSpawn.js";
import { advanceBackgroundSprite } from "./advanceBackgroundSprite.js";
import { captureTargetOnOverlap } from "./captureTargetOnOverlap.js";
import { requestSound10 } from "./requestSound10.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { requestSound19 } from "./requestSound19.js";
import { commitDigEntity } from "./commitDigEntity.js";

// The dig object's state codes and the tile codes it stamps into the maze.
const CARVING_STATE = 48; // DIG_OBJ_STATE while actively tunnelling
const DONE_STATE = 9; // DIG_OBJ_STATE once the run is committed
const WALL_TILE = 193; // the carved channel wall / solid cap
const CHANNEL_TILE = 196; // the dug-channel edge sprite
const FILL_TILE = 112; // the blanked interior tile
const RETREAT_SPRITE = 55; // digging-up animation frame
const ADVANCE_SPRITE = 183; // same frame flipped for digging down (bit-7 flip set)
const COLUMN_HOLD_TIME = 180; // state-timer duration latched when a column completes
const DIG_TILE_TABLE = 0x2dc7; // ROM: dig-channel tile + sub-column -> patched seam tile
const CARVE_CURSOR = 0x80af; // 16-bit live carve cell pointer (published for commitDigEntity)
// 0x8078 = TREASURE_COLLECTED (the treasure-collected byte). This routine reads it here as a
// dig-spawn condition; whether that is a true coupling to the loot flag or byte-reuse is
// UNPROVEN (see ram.js caveat). The earlier "feature-align latch" label was wrong — that role
// belongs to FEATURE_TILE_LATCH (0x8076).

export function advanceDigCarveObject(m) {
  const { mem8 } = m;

  // Fresh frame: no overlap seams until the carve below re-detects them.
  mem8[DIG_OVERLAP_HOLD] = 0;
  mem8[CARVE_SEAM_RIGHT] = 0;
  mem8[CARVE_SEAM_LEFT] = 0;

  // When the tracked object is aligned on a feature cell, either kick off the next
  // queued spawn (nothing spawning) or, unless the dig object is mid-carve, hand the
  // frame to the capture handler.
  if (mem8[TREASURE_COLLECTED] !== 0 && mem8[FEATURE_TILE_LATCH] !== 0) {
    if (mem8[SPAWN_STATE] === 0) return startNextDigSpawn(m);
    if (mem8[DIG_OBJ_STATE] !== CARVING_STATE) return captureTargetOnOverlap(m);
  }

  // Dispatch on the spawn counter.
  const spawn = mem8[SPAWN_STATE];
  if (spawn === 0) return advanceBackgroundSprite(m); // nothing to carve -> per-frame background update
  if (spawn === 2) {
    // A freshly staged target: publish whether the object vertically overlaps it.
    mem8[DIG_OVERLAP_HOLD] = boxOverlap(mem8[OBJ_X], mem8[OBJ_Y], mem8[STAGED_TARGET_X], mem8[STAGED_TARGET_Y]);
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
  mem8[TARGET_X] = u8(mem8[TARGET_X] - 1);
  if (mem8[DIG_OBJ_ARM_STATE] === 0) return armOrProbeCarve(m);
  return completeCarveColumn(m);
}

/**
 * The armed column finished: advance to the next column, re-seed the object's sprite
 * record and sound, clear the spawn counter, hold the object for a fixed time, and — for
 * the special sub-type — cap the two cells above the object's display cell.
 */
function completeCarveColumn(m) {
  const { mem8, mem16 } = m;
  mem8[TARGET_Y] = u8(mem8[TARGET_Y] + 8); // step to the next dig column
  requestSound10(m);
  mem8[SPRITE_CODE] = DONE_STATE;
  stageObjectSpriteRecord(m);
  mem8[SPAWN_STATE] = 0;
  mem8[STATE_TIMER] = COLUMN_HOLD_TIME;
  if (mem8[DIG_OBJ_SUBTYPE] === 2) {
    const cell = mem16[ACTOR_CELL_PTR];
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
    mem8[TARGET_X] = u8(mem8[TARGET_X] - 1);
    stepSprite = RETREAT_SPRITE;
  } else if ((ticked & 3) !== 0) {
    return recomputeOverlapAndStage(m); // mid-phase: no row change
  } else {
    mem8[TARGET_X] = u8(mem8[TARGET_X] + 1);
    stepSprite = ADVANCE_SPRITE;
  }
  return applyCarveStep(m, stepSprite);
}

/** When armed, publish the step's sprite frame (and cap the display cell for the special
 *  sub-type); then re-check the overlap and hand off. */
function applyCarveStep(m, stepSprite) {
  const { mem8, mem16 } = m;
  if (mem8[DIG_OBJ_ARM_STATE] !== 0) {
    mem8[SPRITE_CODE] = stepSprite;
    if (mem8[DIG_OBJ_SUBTYPE] === 2) {
      mem8[mem16[ACTOR_CELL_PTR] - 3] = WALL_TILE;
    }
  }
  return recomputeOverlapAndStage(m);
}

/** Fold the live target box into the overlap flag (never clearing an existing overlap),
 *  then publish the dig-object sprite record. */
function recomputeOverlapAndStage(m) {
  const { mem8 } = m;
  let flag = mem8[DIG_OVERLAP_HOLD];
  if (boxOverlap(mem8[OBJ_X], mem8[OBJ_Y], mem8[TARGET_X], mem8[TARGET_Y])) flag = 1;
  mem8[DIG_OVERLAP_HOLD] = flag;
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
  if (mem8[DIG_OBJ_ARM_STATE] === 0) {
    const objX = mem8[OBJ_X];
    const objY = mem8[OBJ_Y];
    const targetX = mem8[TARGET_X];
    const targetY = mem8[TARGET_Y];
    const rowInBand = u8(targetY + 10) < objY && u8(targetY + 13) >= objY;
    const colInBand = u8(targetX - 3) < objX && u8(targetX + 8) >= objX;
    if (rowInBand && colInBand) {
      mem8[OBJ_X] = u8(targetX + 4); // snap onto the target's near edge
      mem8[DIG_OBJ_ARM_STATE] = 1;
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
  const objY = mem8[OBJ_Y];
  const probeY = u8(mem8[TARGET_Y] - 5);
  if (probeY >= objY) return carveTile(m); // above the object's row band
  if (probeY + 17 > 255) return carveTile(m); // wrapped past the band

  const alignedX = u8(mem8[OBJ_X] + 3) & 0xf8; // object's tile-column boundary (8px)
  const probeX = u8(mem8[TARGET_X] - 1);
  if (probeX === alignedX) {
    mem8[CARVE_SEAM_RIGHT] = 1;
  } else if (u8(probeX + 16) === alignedX) {
    mem8[CARVE_SEAM_LEFT] = 1;
  }
  return carveTile(m);
}

/**
 * Carve one tile. Fold the dig row (TARGET_X) and the just-advanced dig column (TARGET_Y)
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
  const rowTile = u8(31 - (u8(mem8[TARGET_X] + 7) >> 3));
  const column = u8(mem8[TARGET_Y] + 1);
  mem8[TARGET_Y] = column; // advance the dig column
  const colByte = u8(column + 9);
  const colTile = colByte >> 3;
  const cellPtr = 0x9000 + rowTile * 32 + colTile; // VRAM base + row*32 + column
  mem16[CARVE_CURSOR] = cellPtr;

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
  const remapped = mem8[DIG_TILE_TABLE + (existing - 113) * 8 + subCol];
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

  const remaining = u8(mem8[SPAWN_STATE] - 1);
  mem8[SPAWN_STATE] = remaining;
  if (remaining !== 0) return commitDigEntity(m); // more entities in the run

  // Last entity committed: reset the dig row and mark the object done.
  mem8[TARGET_X] = 0;
  mem8[DIG_OBJ_STATE] = DONE_STATE;
  if (mem8[DIG_OBJ_SUBTYPE] === 2) mem8[cellPtr - 1] = WALL_TILE;
  return stageDigObjectSpriteRecord(m);
}
