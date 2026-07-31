// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveActorTerrainStep — resolve a moving actor's horizontal step against the terrain it is entering:
 * collect a loot tile in its path, hold against a wall, bump-react on a blocked diagonal,
 * or let it walk on.  ROM 0x1704.
 *
 * The horizontal counterpart of the vertical/climb handler stepObjectAndResolveTile, reached from the
 * collision arm locateActorCellCheckGoal. It is handed the actor's tile-cell pointer (the cell it stands on;
 * the cell one step ahead is the next byte) and its move direction, and decides the whole
 * outcome of this frame's step by writing to work RAM:
 *
 *   - ON A GRID STEP it first tries to COLLECT a loot tile the actor has aligned onto:
 *       · tile 58 -> award 10 points and count it;
 *       · tiles 59..61 -> award 20 points and count it, gated by a one-shot latch (the very
 *         first time it opens only while the guard byte is clear, and arms itself then).
 *     A collected tile is blanked out of the playfield and the actor walks on.
 *   - Otherwise it CLASSIFIES the terrain the actor is moving into. A set of hard tile codes
 *     (and a solid band) block the step: the actor holds position and its display record is
 *     rebuilt in place. Tiles in the walkable band are checked against a direction-keyed
 *     table of what the terrain "should" be for this heading; a mismatch on a grid step arms
 *     a bump reaction (reaction state 2, the bump sprite, and its timer). The same check then
 *     runs for the tile one step ahead. Anything that clears both checks lets the actor walk.
 *
 * Walking hands off to walkActor (advance position + walk-frame + build the display record);
 * holding and bump-reacting hand off to stageObjectSpriteRecord (rebuild the record in place).
 * Both handoffs return straight to this routine's caller, so they are this routine's return.
 *
 * Kept as resolveActorTerrainStep: the high-level role (the horizontal terrain-interaction/collision handler)
 * is clear from three sources, but its sibling stepObjectAndResolveTile and the wider tile-classify family are
 * still un-named, and which actor it serves plus the direction tables' exact semantics are not
 * yet pinned — a single effect-verb would over- or under-claim, so the neutral name stays.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1704.test.js.
 * GATE:     RAM-only over real captured attract dispatches (0x1704 runs 77x in a plain attract
 *           run, exercising the wall-block, bump-react and walk-on paths) + crafted loot-collect
 *           entries for the tiles attract never aligns onto (58 and 59..61 across latch/guard),
 *           plus a crafted bump-react entry. Excludes the dead stack scratch the still-oracle
 *           comparison run parks below the entry stack pointer (the idiomatic handoffs are
 *           stack-free). Teeth: a dropped loot count, a skipped bump reaction, a corrupted walk.
 * LIVE-OUT: memory-only — the two pickup counters, the score + repainted digits + queued sound
 *           (on a collect), the blanked cell, the bump-reaction state/timer/sprite, the walk
 *           position + frame, and the display record. No register live-out (the oracle tail-jumps
 *           to the record builder, whose result is the whole output and lives in RAM).
 * NAMES:    CUR_TILE, NEXT_TILE, PRIZE_GATE, HAZARD_ACTIVE_COUNT, PLAYER_CELL_PTR, REACTION_STATE,
 *           REACTION_TIMER, PLAYER_FACING from ram.js; the pickup counters 0x8081/0x8082, the +20
 *           latch 0x8078, and the current scratch copy 0x80a7 stay hex (clear here, not yet grounded
 *           across the game); the ahead scratch copy is AHEAD_TILE_RAW (0x80a6) and the reaction
 *           period is REACTION_PERIOD (0x80a3). The two direction
 *           tables live in ROM at 0x1b78 / 0x1ce0.
 *
 * PURPOSE [guess]: "Actor"=vocab (walkActor); tables unpinned.
 */

import {
  CUR_TILE,
  NEXT_TILE,
  PRIZE_GATE,
  HAZARD_ACTIVE_COUNT,
  PLAYER_CELL_PTR,
  REACTION_STATE,
  REACTION_TIMER,
  PLAYER_FACING,
  REACTION_PERIOD,
  AHEAD_TILE_RAW,
} from "./ram.js";
import { awardTenPoints } from "./awardTenPoints.js";
import { awardTwentyPoints } from "./awardTwentyPoints.js";
import { walkActor } from "./walkActor.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

// Scratch slots that mirror the tile under the actor (0x80a5 is CUR_TILE); the direction-table
// check overwrites CUR_TILE_COPY with the tile it EXPECTS, and the final walk-vs-react decision
// re-reads it. AHEAD_TILE_RAW holds the raw tile one step ahead.
const CUR_TILE_COPY = 0x80a7;

// The two per-kind pickup counters and the one-shot latch that gates the +20 loot (roles clear
// here but not grounded across the game — matching collectLootTile's local naming).
const FIRST_LOOT_COUNT = 0x8081; // times a tile-58 pickup was collected
const SECOND_LOOT_COUNT = 0x8082; // times a tile-59..61 pickup was collected
const SECOND_LOOT_LATCH = 0x8078; // one-shot latch that opens the +20 loot

// Direction-keyed "expected terrain" tables in ROM: one for the tile the actor stands on, one
// for the tile one step ahead. Row = tile - FIRST_TABLE_TILE, column = the direction's low bits.
const EXPECTED_TILE_TABLE = 0x1b78; // current tile
const EXPECTED_NEXT_TILE_TABLE = 0x1ce0; // tile ahead

const BLANK_TILE = 112; // empty-cell tile stamped over a collected pickup
const FEATURE_TILE = 38; // tile 0x26 — latched so the +20 loot gate can see it next frame

// Walkable tiles are the band [113, 158); the direction table is indexed within it.
const WALK_BAND_LO = 113;
const WALK_BAND_HI = 158;

// Blocking tile codes for the tile the actor stands on: it cannot step off onto them, so it holds.
const SOLID_CURRENT = new Set([42, 65, 149, 193, 196, 201]);
// Blocking tile codes for the tile one step ahead (a different set — 196/197/201 are handled
// separately below).
const SOLID_NEXT = new Set([42, 65, 149, 193]);

/** Stamp the blanked cell over the collected pickup and let the actor walk on. */
function consumeLootAndWalk(m) {
  const { mem8, mem16 } = m;
  mem8[mem16[PLAYER_CELL_PTR]] = BLANK_TILE;
  return walkActor(m);
}

/** Arm the bump reaction (state, timer, sprite) and rebuild the display record in place. */
function armBumpReaction(m) {
  const { mem8 } = m;
  mem8[REACTION_TIMER] = mem8[REACTION_PERIOD];
  mem8[REACTION_STATE] = 2;
  mem8[PLAYER_FACING] = 0x35;
  return stageObjectSpriteRecord(m);
}

/**
 * Whether the +20 loot may be collected this frame, arming its one-shot latch as a side effect.
 * Once the latch is open the loot always pays out; the first time, it opens only while the guard
 * (a spawn-in-progress flag) is clear, and arming the latch is what records that first open.
 */
function secondLootAllowed(m) {
  const { mem8 } = m;
  if (mem8[SECOND_LOOT_LATCH] !== 0) return true; // already open
  if (mem8[HAZARD_ACTIVE_COUNT] !== 0) return false; // guard closed this frame
  mem8[SECOND_LOOT_LATCH] = 1; // first open — arm the latch
  return true;
}

export function resolveActorTerrainStep(m, tilePtr = m.regs.ix, moveDir = m.regs.d) {
  const { mem8 } = m;

  // Read the tile the actor is stepping onto, publish it (two copies), pre-clear the next slot.
  mem8[NEXT_TILE] = 0;
  const tile = mem8[tilePtr];
  mem8[CUR_TILE] = tile;
  mem8[CUR_TILE_COPY] = tile;

  const dirLow = moveDir & 7;
  const onGrid = dirLow === 0;

  // ---- On a grid step, first try to collect a loot tile in the actor's path ----
  if (onGrid) {
    if (tile === 58) {
      awardTenPoints(m); // +10 and its sound
      mem8[FIRST_LOOT_COUNT] = mem8[FIRST_LOOT_COUNT] + 1;
      return consumeLootAndWalk(m);
    }
    if (tile >= 59 && tile <= 61 && secondLootAllowed(m)) {
      awardTwentyPoints(m); // +20 and its sound
      mem8[SECOND_LOOT_COUNT] = mem8[SECOND_LOOT_COUNT] + 1;
      return consumeLootAndWalk(m);
    }
    // Not a collectible (or gated off) — fall through to the terrain classify.
  }

  // ---- Classify the terrain the actor is moving into ----

  // Latch the feature tile so the +20 loot gate can see it next frame.
  if (tile === FEATURE_TILE) mem8[PRIZE_GATE] = FEATURE_TILE;

  // Decide the tile the actor stands on: solid (hold), walkable-band (direction table), or pass.
  let checkCurrentTable = false;
  if (SOLID_CURRENT.has(tile)) {
    return stageObjectSpriteRecord(m); // blocked — hold, rebuild the record in place
  } else if (tile === 197) {
    // 0xc5 — a diagonal-only block: passable only when the direction's bit-2 flag is set.
    if ((moveDir & 4) === 0) return stageObjectSpriteRecord(m);
    checkCurrentTable = true;
  } else if (tile < 150) {
    checkCurrentTable = true;
  } else if (tile < 154) {
    return stageObjectSpriteRecord(m); // 150..153 — solid band
  } else if (tile >= WALK_BAND_HI) {
    // 158+ — passable, skip straight to the tile-ahead phase.
  } else {
    // 154..157 — the same diagonal-only block as 197.
    if ((moveDir & 4) === 0) return stageObjectSpriteRecord(m);
    checkCurrentTable = true;
  }

  if (checkCurrentTable && tile >= WALK_BAND_LO && tile < WALK_BAND_HI) {
    // What the terrain SHOULD be under the actor for this heading; publish it for the final check.
    const expected = mem8[EXPECTED_TILE_TABLE + (tile - WALK_BAND_LO) * 8 + dirLow];
    mem8[CUR_TILE_COPY] = expected;
    // A mismatch on a grid step is a wall the actor bumped — arm the reaction. A mismatch off
    // the grid is carried forward and caught by the final check after the tile-ahead phase.
    if (expected !== tile && onGrid) return armBumpReaction(m);
  }

  // ---- Tile-ahead phase ----

  // On a clear grid step the actor simply walks; otherwise examine the tile one step ahead.
  if (onGrid) return walkActor(m);

  const nextTile = mem8[tilePtr + 1];
  mem8[AHEAD_TILE_RAW] = nextTile;

  if (SOLID_NEXT.has(nextTile)) return stageObjectSpriteRecord(m); // blocked ahead — hold

  // Two bands go through the diagonal-only block, which first steps the heading down by one; the
  // stepped heading is what indexes the tile-ahead table. (This phase only runs off the grid, so
  // the heading's low bits are non-zero and the step never underflows.)
  let nextDir = moveDir;
  let checkNextTable = false;
  if (nextTile === 196) {
    nextDir = moveDir - 1;
    if (nextDir & 4) return stageObjectSpriteRecord(m);
    checkNextTable = true;
  } else if (nextTile < 150) {
    checkNextTable = true;
  } else if (nextTile >= 154) {
    // passable ahead — skip to the final check
  } else {
    // 150..153 — the diagonal-only block
    nextDir = moveDir - 1;
    if (nextDir & 4) return stageObjectSpriteRecord(m);
    checkNextTable = true;
  }

  if (checkNextTable && nextTile >= WALK_BAND_LO && nextTile < WALK_BAND_HI) {
    const expected = mem8[EXPECTED_NEXT_TILE_TABLE + (nextTile - WALK_BAND_LO) * 8 + (nextDir & 7)];
    mem8[NEXT_TILE] = expected;
    if (expected !== nextTile) return armBumpReaction(m); // wall ahead — bump-react
  }

  // Final check: if the current-tile scratch no longer matches the saved current tile (a carried
  // mismatch from the walkable-band check), bump-react; otherwise the actor walks on.
  if (mem8[CUR_TILE_COPY] !== mem8[CUR_TILE]) return armBumpReaction(m);
  return walkActor(m);
}
