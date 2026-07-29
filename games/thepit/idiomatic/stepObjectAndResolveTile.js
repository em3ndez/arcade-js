// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectAndResolveTile — step the tracked object one frame along its climb axis and resolve the tile it
 * lands on: collect loot, carve into terrain, block, or keep moving.  ROM 0x1a02.
 *
 * The vertical-move counterpart of the tracked object's horizontal walk-and-classify handler:
 * it runs only while the climb gate is clear (otherwise it just defers the frame), and it folds
 * three jobs the horizontal side splits across helpers into one routine — locate the object's
 * tile cell, collect any loot there, and classify solid/diggable terrain.
 *
 * It first works out which tile cell of the on-screen map the object occupies (the same
 * row/column cell geometry the horizontal handler uses, with the caller's column bias), builds
 * the video-RAM address of that cell, and reads and publishes the tile under it. Two special
 * columns short-circuit: at the top-rung column there is nothing to resolve (if the second-loot
 * latch is already set it records the top-rung spawn flag), and once the object retreats below
 * the crossing column the goal-reached latch is cleared.
 *
 * Then it resolves the tile:
 *   - Right as the object crosses a cell boundary, loot sitting in the cell is collected — the
 *     10-point tile awards 10 and bumps its tally; the 20-point tiles record their code, award
 *     20, and bump theirs — and the cell is blanked before the object keeps moving.
 *   - Solid tiles block: the frame is deferred with no move.
 *   - A diggable tile is compared against the terrain the current-cell table says should be
 *     here for this sub-cell phase. A match means the object passes through and keeps moving; a
 *     mismatch means it has run into fresh terrain, so it arms the carve reaction (reload its
 *     timer, select the carve step, show the carve sprite) and — unless the next sub-cell rolls
 *     onto a boundary — records the neighbouring cell's expected terrain for the reaction.
 *   - Anything else is passable: the object advances one step and cycles its walk-frame sprite.
 *
 * Every outcome ends by building the object's deferral record (stageObjectSpriteRecord), whose
 * own return unwinds to this routine's caller — so building the record is this routine's return.
 *
 * The role (step-and-resolve-tile) is clear. The "climb / vertical" axis — earlier only an
 * inference — is now GROUNDED: the digger surfaces to WIN at the top rung (PLAYER_X == 0x23, offset 3
 * decreasing = up), which fixes offset 3 as the screen-vertical axis. The name stays generic only
 * because the routine does more than climb (it also resolves and collects the cell's tile).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a02.test.js.
 * GATE:     RAM-only over real captured attract dispatches (stepObjectAndResolveTile runs ~16x in a plain
 *           boot/attract run, the object stepping down its column) + crafted cell-tile entries
 *           for the loot / solid / diggable / top-rung arms attract's natural path never hits.
 *           Excludes the dead stack scratch the still-oracle comparison run parks below the entry
 *           stack pointer (the idiomatic callees are stack-free). Teeth: wrong published tile,
 *           wrong stepped position, wrong sprite frame.
 * LIVE-OUT: memory-only — the row/column cells, the cell address, the published under-tile and
 *           cleared next-tile slot, the sprite frame, the collected-loot tallies + blanked cell,
 *           the carve-reaction bytes, the stepped position, and the deferral record. No live
 *           registers of its own; the column bias is a genuine register live-in surfaced as the
 *           columnBias parameter (defaulting to the register, so a no-arg call matches the oracle).
 * NAMES:    MOVE_BLOCK_FLAG, PLAYER_FACING, PLAYER_Y, PLAYER_TILE_ROW, PLAYER_X, PLAYER_TILE_COL, BOARD_END_PHASE,
 *           GOAL_TILE_LATCH, PLAYER_CELL_PTR, NEXT_TILE, CUR_TILE, REACTION_STATE, REACTION_TIMER
 *           from ram.js. The two loot tallies 0x8081/0x8082, the second-loot latch 0x8078
 *           (ram.js TREASURE_COLLECTED), and
 *           the blank tile match the horizontal collector; the carve-reaction scratch 0x80a3/
 *           0x80a6/0x80a7, the step delta 0x806d, the video-RAM base, and the two ROM
 *           expected-terrain tables at 0x2118 / 0x2280 stay hex — grounded here but not across
 *           the game.
 */

import {
  MOVE_BLOCK_FLAG,
  PLAYER_FACING,
  PLAYER_Y,
  PLAYER_TILE_ROW,
  PLAYER_X,
  PLAYER_TILE_COL,
  BOARD_END_PHASE,
  GOAL_TILE_LATCH,
  PLAYER_CELL_PTR,
  NEXT_TILE,
  CUR_TILE,
  REACTION_STATE,
  REACTION_TIMER,
} from "./ram.js";
import { u8 } from "../../../core/int.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { awardTenPoints } from "./awardTenPoints.js";
import { awardTwentyPoints } from "./awardTwentyPoints.js";

// Base of the on-screen tile map in video RAM; a cell is an offset from here.
const VRAM_BASE = 0x9000;

// ROM tables of the terrain a cell is expected to hold, one row per diggable tile code
// (113..157) and sub-cell phase (0..7): the current cell's table, then the neighbouring cell's.
const EXPECTED_TILE_TABLE = 0x2118;
const NEIGHBOUR_TILE_TABLE = 0x2280;

// Loot bookkeeping shared with the horizontal collector (roles legible here, not yet grounded
// across the game, so kept as addresses).
const FIRST_LOOT_TALLY = 0x8081; // times a 10-point pickup was collected
const SECOND_LOOT_TALLY = 0x8082; // times a 20-point pickup was collected
const SECOND_LOOT_LATCH = 0x8078; // records the collected 20-point code; gates the top-rung flag

// Carve-reaction scratch (the reaction state/timer are named; these three are not yet grounded).
const REACTION_PERIOD = 0x80a3; // reload value copied into the reaction timer when a carve arms
const NEIGHBOUR_TILE = 0x80a6; // the neighbouring cell's tile, recorded for the reaction
const EXPECTED_TILE = 0x80a7; // the under-tile, then overwritten with the cell's expected terrain

const STEP_DELTA = 0x806d; // how far the object moves along its column each step

// Tile codes and sprite frames (opaque data values, not bit operations, so written in decimal).
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

  // Vertical move runs only while the climb gate is clear; otherwise just defer the frame.
  if (mem8[MOVE_BLOCK_FLAG] !== 0) return stageObjectSpriteRecord(m);

  // Default walk-frame sprite; the tile resolution below overrides it where needed.
  mem8[PLAYER_FACING] = WALK_FRAME_A;

  // Which map row is the object on? Bias the vertical counter, drop it to an 8-pixel cell, and
  // flip it so screen-top is the highest index (32 rows, indices 0..31).
  const row = 31 - (u8(mem8[PLAYER_Y] + 3) >> 3);
  mem8[PLAYER_TILE_ROW] = row;

  const objY = mem8[PLAYER_X];

  // Top-rung column (PLAYER_X == 0x23, the object surfacing UP): nothing to resolve. If a +20 diamond
  // was already collected (SECOND_LOOT_LATCH 0x8078 = ram.js TREASURE_COLLECTED), set the top-rung
  // spawn flag BOARD_END_PHASE = 1 — the observed LEVEL-COMPLETE trigger. Either way defer this frame.
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
      // 10-point pickup: award, count it, blank the cell, keep moving.
      awardTenPoints(m);
      mem8[FIRST_LOOT_TALLY] = mem8[FIRST_LOOT_TALLY] + 1;
      mem8[cellPtr] = BLANK_TILE;
      return advanceStepAndStage(m);
    }
    if (tile >= TWENTY_POINT_LOOT_LO && tile <= TWENTY_POINT_LOOT_HI) {
      // 20-point pickup: record its code, award, count it, blank the cell, keep moving.
      mem8[SECOND_LOOT_LATCH] = tile;
      awardTwentyPoints(m);
      mem8[SECOND_LOOT_TALLY] = mem8[SECOND_LOOT_TALLY] + 1;
      mem8[cellPtr] = BLANK_TILE;
      return advanceStepAndStage(m);
    }
    // Not loot: fall through to the solid/diggable classification.
  }

  // ---- Classify the tile: solid (block), passable (keep moving), or diggable (carve) ----

  // Tiles that always block: defer the frame, no move.
  if (tile === 42 || tile === 65 || tile === 193) return stageObjectSpriteRecord(m);

  // Two reactive bands are gated by the sub-cell phase's bit 2: a single special code (197) and
  // the 154..157 band read as blocking unless that bit is set.
  const phaseGateOpen = (positionAccumulator & 4) !== 0;
  if (tile === 197) {
    if (!phaseGateOpen) return stageObjectSpriteRecord(m); // blocked
    // gate open: 197 sits above the diggable band, handled as passable below
  } else if (tile >= 149 && tile <= 153) {
    return stageObjectSpriteRecord(m); // this mid band always blocks
  } else if (tile >= 154 && tile <= 157) {
    if (!phaseGateOpen) return stageObjectSpriteRecord(m); // blocked
    // gate open: falls into the diggable band below
  } else if (tile >= DIGGABLE_HIGH) {
    return advanceStepAndStage(m); // above every reactive band -> passable
  }

  // What remains is below the diggable band, or the gate-open 197 above it: passable.
  if (tile < DIGGABLE_LOW || tile >= DIGGABLE_HIGH) return advanceStepAndStage(m);

  // ---- Diggable band: compare against the terrain this cell is expected to hold ----
  const subCell = positionAccumulator & 7;
  const expected = mem8[EXPECTED_TILE_TABLE + (tile - DIGGABLE_LOW) * 8 + (7 - subCell)];
  mem8[EXPECTED_TILE] = expected;

  // Terrain still matches what's there — nothing has changed, keep moving.
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
  mem8[NEIGHBOUR_TILE] = neighbourTile;
  if (neighbourTile >= DIGGABLE_LOW && neighbourTile < DIGGABLE_HIGH) {
    mem8[NEXT_TILE] = mem8[NEIGHBOUR_TILE_TABLE + (neighbourTile - DIGGABLE_LOW) * 8 + nextSubCell];
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
