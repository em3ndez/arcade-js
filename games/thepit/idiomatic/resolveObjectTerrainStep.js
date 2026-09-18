// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveObjectTerrainStep — resolve a moving object's step against the terrain directly under it
 * (and, off the grid, the tile one step ahead): hold against a solid, push a pushable block, or walk
 * on. The standalone entry of the tile-under-object resolver, reached when the collision dispatcher
 * finds the object is NOT sitting on a collectible or gate tile — the counterpart of the horizontal
 * handler resolveActorTerrainStep. It is handed the tile the object sits ON, the object's biased tile
 * column (whose low 3 bits are the sub-tile offset), and the object's tile-cell pointer (the cell one
 * step ahead is the next byte), and writes the whole outcome of the step to work RAM:
 *   - It first LATCHES the two special tiles the object can sit exactly on (the feature tile and the
 *     goal tile), for later feature/goal logic.
 *   - It then classifies the tile UNDER the object. Solid ids hold it in place; two diagonal-block
 *     tiles are passable only when a sub-tile-offset gate bit is set. Tiles in the pushable band are
 *     checked against an expected-terrain table for this sub-offset; a mismatch on an aligned step
 *     means a pushable block was met, so it ARMS the push reaction. Off the grid the same test runs
 *     for the tile one step ahead (its own table), and a final cross-check re-arms the push if the
 *     under tile changed out from beneath the object.
 *
 * Walking hands off to advanceObjectWalkFrame (step the walk animation + build the display record);
 * holding, arming, and every settled case hand off to the record builder stageObjectSpriteRecord.
 */

import {
  PRIZE_GATE,
  GOAL_TILE_LATCH,
  EXPECTED_TILE,
  NEXT_TILE,
  CUR_TILE,
  REACTION_STATE,
  REACTION_TIMER,
  PLAYER_FACING,
  REACTION_PERIOD,
  AHEAD_TILE_RAW,
} from "./names.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";

// The two special tiles the object can sit exactly on, latched for later feature/goal logic.
const FEATURE_TILE = 38;
const GOAL_TILE = 39;

// Solid tiles: the object cannot settle onto them, so it holds and the frame is deferred.
const SOLID_UNDER = new Set([42, 65, 193, 149, 196]);
const DIAGONAL_BLOCK = 197; // passable only when the sub-tile-offset gate bit is set

// The pushable band and its two lookup tables (expected terrain per tile + sub-offset).
const PUSHABLE_LO = 113; // first tile in the band (exclusive upper end at PUSHABLE_HI)
const PUSHABLE_HI = 158;
const UNDER_TILE_TABLE = 0x1b78; // expected tile UNDER the object
const AHEAD_TILE_TABLE = 0x1ce0; // expected tile one step AHEAD

// The sprite/handler code that plays the object's push reaction.
const PUSH_HANDLER_SPRITE = 0xb5;

/** Arm the push reaction (state, timer, sprite) and rebuild the display record in place. */
function armPushReaction(m) {
  const { mem8 } = m;
  mem8[REACTION_TIMER] = mem8[REACTION_PERIOD];
  mem8[REACTION_STATE] = 1;
  mem8[PLAYER_FACING] = PUSH_HANDLER_SPRITE;
  return stageObjectSpriteRecord(m);
}

/** Cross-check the under-tile record: if the terrain the object was standing on changed out from
 *  beneath it, arm the push; otherwise the object walks on. */
function crossCheckUnderRecord(m) {
  const { mem8 } = m;
  if (mem8[EXPECTED_TILE] !== mem8[CUR_TILE]) return armPushReaction(m);
  return advanceObjectWalkFrame(m);
}

/** Resolve the tile one step AHEAD (reached only off the grid): hold on a solid, push a mismatched
 *  pushable block, or fall through to the under-record cross-check. */
function resolveTileAhead(m, column, cellPtr) {
  const { mem8 } = m;

  const aheadTile = mem8[(cellPtr + 1) & 0xffff];
  mem8[AHEAD_TILE_RAW] = aheadTile;

  // Solid tiles ahead: hold and defer.
  if (aheadTile === 42 || aheadTile === 65 || aheadTile === 193) {
    return stageObjectSpriteRecord(m);
  }

  // Diagonal-block tiles ahead (0xc4 and the 0x96..0x99 band) step the sub-tile offset down one,
  // then hold unless bit 2 of the stepped offset is clear.
  let aheadColumn = column;
  if (aheadTile === 196 || (aheadTile >= 150 && aheadTile <= 153)) {
    aheadColumn = column - 1;
    if ((aheadColumn & 4) !== 0) return stageObjectSpriteRecord(m);
  } else if (aheadTile === 149) {
    return stageObjectSpriteRecord(m); // solid ahead: hold
  } else if (aheadTile >= 154) {
    return crossCheckUnderRecord(m); // above the pushable band: settle on the under record
  }
  // else aheadTile <= 148 (not a solid): drop into the push-table test

  // Push-table test for the tile ahead: a mismatch means a pushable block ahead -> arm the push.
  if (aheadTile >= PUSHABLE_LO && aheadTile < PUSHABLE_HI) {
    const expected = mem8[AHEAD_TILE_TABLE + (aheadTile - PUSHABLE_LO) * 8 + (aheadColumn & 7)];
    mem8[NEXT_TILE] = expected;
    if (expected !== aheadTile) return armPushReaction(m);
  }
  return crossCheckUnderRecord(m);
}

export function resolveObjectTerrainStep(m, underTile = m.regs.b, column = m.regs.d, cellPtr = m.regs.ix) {
  const { mem8 } = m;

  // Latch the two special tiles the object can sit exactly on.
  if (underTile === FEATURE_TILE) mem8[PRIZE_GATE] = FEATURE_TILE;
  if (underTile === GOAL_TILE) mem8[GOAL_TILE_LATCH] = GOAL_TILE;

  const subOffset = column & 7; // where the object sits within its tile cell (0 = grid-aligned)
  const onGrid = subOffset === 0;

  // ---- Classify the tile UNDER the object ----
  if (SOLID_UNDER.has(underTile)) {
    return stageObjectSpriteRecord(m); // solid: hold, defer this frame
  }

  // Decide whether the under tile runs the push-table test.
  let runUnderPushTest;
  if (underTile === DIAGONAL_BLOCK || (underTile >= 154 && underTile <= 157)) {
    // Diagonal-block tiles: passable only when bit 2 of the sub-tile offset is set.
    if ((column & 4) === 0) return stageObjectSpriteRecord(m);
    runUnderPushTest = true;
  } else if (underTile < 150) {
    runUnderPushTest = true;
  } else if (underTile < 154) {
    return stageObjectSpriteRecord(m); // 0x96..0x99: solid band, hold
  } else {
    runUnderPushTest = false; // 0x9e and up: already settled
  }

  // Push-table test for the tile under the object: a mismatch is a pushable block met head-on.
  if (runUnderPushTest && underTile >= PUSHABLE_LO && underTile < PUSHABLE_HI) {
    const expected = mem8[UNDER_TILE_TABLE + (underTile - PUSHABLE_LO) * 8 + subOffset];
    mem8[EXPECTED_TILE] = expected;
    if (expected !== underTile) {
      // Mismatch: an aligned step arms the push; off the grid, look at the tile ahead.
      if (onGrid) return armPushReaction(m);
      return resolveTileAhead(m, column, cellPtr);
    }
    // matched: the under tile is settled
  }

  // ---- Settle: aligned means the under tile resolves to a walk; else look ahead ----
  if (onGrid) return advanceObjectWalkFrame(m);
  return resolveTileAhead(m, column, cellPtr);
}
