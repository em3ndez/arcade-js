// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1515 — resolve the tile the object is sitting on: collect a loot tile it has landed
 * squarely on (score + remove it), otherwise resolve how it meets the terrain.  ROM 0x1515.
 *
 * The grid-aligned-loot-aware front of the tile-under-object resolver loc_1568 — the entry
 * the collision dispatcher (loc_14cd) reaches for an object standing on a cell. It is handed
 * the object's biased tile column (whose low 3 bits are the sub-tile offset within the cell)
 * and the object's tile-cell pointer, and it first records the tile under the object as both
 * the saved-current tile and the starting expected-tile.
 *
 * Only when the object is grid-aligned (squarely inside a cell) can it collect the loot it is
 * sitting on. There are two loot kinds, mirroring the horizontal walk path's collectLootTile:
 *
 *   - Tile 58: award 10 points, bump its pickup count, blank the cell, and walk on.
 *   - Tiles 59..61: award 20 points, gated by a one-shot latch. Once the latch is armed those
 *     tiles always score; arming it the very first time is blocked while a dig spawn is active,
 *     and that blocked frame falls through to a plain terrain step instead. (Unlike the
 *     horizontal collectLootTile, this path has no separate feature-enable gate.)
 *
 * The award itself only moves the score while a player is active (the shared scorer skips an
 * idle slot, as in the attract demo), but the pickup count, the queued sound, and the blanked
 * cell land every time. Every non-collect case — off the grid, or on any tile that is not loot
 * — hands the whole step to the terrain resolver loc_1568 (hold against a solid, push a
 * pushable block, or walk on), whose result is this routine's result.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1515.test.js.
 * GATE:     crafted-entry — attract never digs an object into this case (measured 0 dispatches
 *           in 4000 frames), so the gate runs it from real captured attract clones with its two
 *           inputs poked: the loot paths (tile 58 and 59..61 over the latch/guard branches) and
 *           the delegated terrain paths, sweeping the under tile over all 256 ids across every
 *           sub-offset. The two loot awards reach the score adder through the oracle's ordinary
 *           calls, which park a few dead bytes just below the entry stack pointer that the
 *           stack-free idiomatic never writes, so the diff excludes that stack-top window.
 *           Teeth: a dropped pickup count, an un-blanked cell.
 * LIVE-OUT: memory-only — the saved-current / expected-tile records, the two pickup counts, the
 *           second-loot latch, the queued sound and score, the blanked cell, and whatever the
 *           walk step or the terrain resolver leaves. No register live-out (the walk path's phase
 *           is set inside advanceObjectWalkFrame, already covered by its own gate).
 * NAMES:    CUR_TILE, EXPECTED_TILE, LOOT_10PT_COUNT, LOOT_20PT_COUNT, SPAWN_STATE,
 *           ACTOR_CELL_PTR from ram.js. The one-shot second-loot latch 0x8078 stays hex — its
 *           role is clear here but not yet grounded across the game. The terrain classification,
 *           its ROM tables, and the push-reaction state live inside loc_1568.
 */

import {
  CUR_TILE,
  EXPECTED_TILE,
  LOOT_10PT_COUNT,
  LOOT_20PT_COUNT,
  SPAWN_STATE,
  ACTOR_CELL_PTR,
} from "./ram.js";
import { awardTenPoints } from "./awardTenPoints.js";
import { awardTwentyPoints } from "./awardTwentyPoints.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";
import { loc_1568 } from "./loc_1568.js";

// One-shot latch that opens the 20-point loot: once armed, tiles 59..61 always score. Its
// role is legible here but not yet grounded across routines, so the address stays hex.
const SECOND_LOOT_LATCH = 0x8078;

const BLANK_TILE = 112; // the empty-cell tile stamped over a collected pickup

/** Blank the collected cell the object stands on, then step its walk animation + record. */
function clearCollectedCellAndWalk(m) {
  const { mem8, mem16 } = m;
  mem8[mem16[ACTOR_CELL_PTR]] = BLANK_TILE;
  return advanceObjectWalkFrame(m);
}

export function loc_1515(m, column = m.regs.d, cellPtr = m.regs.ix) {
  const { mem8 } = m;

  // The tile the object is sitting on. Record it as the saved-current and starting
  // expected-tile before anything reclassifies it.
  const underTile = mem8[cellPtr];
  mem8[CUR_TILE] = underTile;
  mem8[EXPECTED_TILE] = underTile;

  // Only a grid-aligned object (squarely inside a cell) collects the loot beneath it.
  const onGrid = (column & 7) === 0;

  if (onGrid) {
    // First loot kind: 10 points, count it, blank the cell, walk on.
    if (underTile === 58) {
      awardTenPoints(m);
      mem8[LOOT_10PT_COUNT] = mem8[LOOT_10PT_COUNT] + 1;
      return clearCollectedCellAndWalk(m);
    }

    // Second loot kind: 20 points, gated by the one-shot latch. Once armed these tiles
    // always score; the first arming is blocked while a dig spawn is active (that frame
    // falls through to a plain terrain step).
    if (underTile >= 59 && underTile <= 61) {
      if (mem8[SECOND_LOOT_LATCH] === 0) {
        if (mem8[SPAWN_STATE] !== 0) return loc_1568(m, underTile, column, cellPtr);
        mem8[SECOND_LOOT_LATCH] = 1;
      }
      awardTwentyPoints(m);
      mem8[LOOT_20PT_COUNT] = mem8[LOOT_20PT_COUNT] + 1;
      return clearCollectedCellAndWalk(m);
    }
  }

  // Off the grid, or on any non-loot tile: resolve how the object meets the terrain under
  // it (and, off the grid, the tile one step ahead) — hold, push, or walk on.
  return loc_1568(m, underTile, column, cellPtr);
}
