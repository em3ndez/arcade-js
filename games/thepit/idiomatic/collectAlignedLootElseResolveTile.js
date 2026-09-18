// SPDX-License-Identifier: GPL-3.0-only
/**
 * collectAlignedLootElseResolveTile — resolve the tile the object sits on: collect a loot tile it has
 * landed squarely on (score and remove it), otherwise resolve how it meets the terrain.
 *
 * The grid-aligned-loot-aware front of the tile-under-object resolver, the entry the collision
 * dispatcher reaches for an object standing on a cell. Handed the object's biased tile column (low 3
 * bits are the sub-tile offset) and its tile-cell pointer, it first records the tile under the object
 * as both CUR_TILE and the starting EXPECTED_TILE. Only a grid-aligned object (squarely inside a
 * cell) collects the loot beneath it, of two kinds: tile 58 awards 10 points and bumps its pickup
 * count; tiles 59..61 award 20 points, gated by a one-shot latch that, once armed, always scores —
 * but arming it the first time is blocked while a dig spawn is active, and that frame falls through
 * to a plain terrain step. The award moves the score only while a player is active, but the pickup
 * count, sound, and blanked cell land every time. Every non-collect case hands the whole step to the
 * terrain resolver, whose result is this routine's result.
 */

import { CUR_TILE, EXPECTED_TILE, CRYSTAL_COUNT, DIAMOND_COUNT, HAZARD_ACTIVE_COUNT, PLAYER_CELL_PTR, TREASURE_COLLECTED } from "./names.js";
import { awardTenPoints } from "./awardTenPoints.js";
import { awardTwentyPoints } from "./awardTwentyPoints.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";
import { resolveObjectTerrainStep } from "./resolveObjectTerrainStep.js";

// One-shot latch that opens the 20-point loot: once armed, tiles 59..61 always score.
const SECOND_LOOT_LATCH = TREASURE_COLLECTED;

const BLANK_TILE = 112; // the empty-cell tile stamped over a collected pickup

/** Blank the collected cell the object stands on, then step its walk animation + record. */
function clearCollectedCellAndWalk(m) {
  const { mem8, mem16 } = m;
  mem8[mem16[PLAYER_CELL_PTR]] = BLANK_TILE;
  return advanceObjectWalkFrame(m);
}

export function collectAlignedLootElseResolveTile(m, column = m.regs.d, cellPtr = m.regs.ix) {
  const { mem8 } = m;

  // The tile the object is sitting on, recorded before anything reclassifies it.
  const underTile = mem8[cellPtr];
  mem8[CUR_TILE] = underTile;
  mem8[EXPECTED_TILE] = underTile;

  const onGrid = (column & 7) === 0;

  if (onGrid) {
    // First loot kind: 10 points, count it, blank the cell, walk on.
    if (underTile === 58) {
      awardTenPoints(m);
      mem8[CRYSTAL_COUNT] = mem8[CRYSTAL_COUNT] + 1;
      return clearCollectedCellAndWalk(m);
    }

    // Second loot kind: 20 points, gated by the one-shot latch. Once armed these tiles
    // always score; the first arming is blocked while a dig spawn is active (that frame
    // falls through to a plain terrain step).
    if (underTile >= 59 && underTile <= 61) {
      if (mem8[SECOND_LOOT_LATCH] === 0) {
        if (mem8[HAZARD_ACTIVE_COUNT] !== 0) return resolveObjectTerrainStep(m, underTile, column, cellPtr);
        mem8[SECOND_LOOT_LATCH] = 1;
      }
      awardTwentyPoints(m);
      mem8[DIAMOND_COUNT] = mem8[DIAMOND_COUNT] + 1;
      return clearCollectedCellAndWalk(m);
    }
  }

  // Off the grid, or on any non-loot tile: resolve how the object meets the terrain under
  // it (and, off the grid, the tile one step ahead) — hold, push, or walk on.
  return resolveObjectTerrainStep(m, underTile, column, cellPtr);
}
