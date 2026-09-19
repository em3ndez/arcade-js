// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveObjectTile — locate the tracked object's tile cell, read the tile under it, and hand the
 * object to the matching per-frame handler.
 *
 * From the object's two position counters (plus a caller horizontal bias) it works out the map cell
 * the object occupies, builds that cell's video address, reads the tile, and publishes the cell
 * address and tile (two copies), clearing the "next tile" slot. Then it routes: ordinary tile ->
 * loot/dig collector (given the tile code and the biased position that marks tile-boundary crossings);
 * goal tile -> latch goal-reached, and once past the crossing position record it and hand to the
 * walk-forward continuation. The handoff is this routine's whole remaining work and its return.
 */

import { PLAYER_CELL_PTR, CUR_TILE, EXPECTED_TILE, PIT_CROSS_ACTIVE, GOAL_TILE_LATCH, NEXT_TILE, PLAYER_TILE_COL, PLAYER_TILE_ROW, PLAYER_Y, PLAYER_X, VIDEO_RAM_BASE } from "./names.js";
import { u8 } from "../../../core/int.js";
import { collectLootTile } from "./collectLootTile.js";
import { advanceActorWalk } from "./advanceActorWalk.js";

// Base address of the on-screen tile map in video RAM; an object's cell is an offset from here.

// The special tile marking the goal the object crosses toward.
const GOAL_TILE = 39;
// Horizontal position at/after which standing on the goal tile counts as having crossed.
const CROSSING_POSITION = 83;

export function resolveObjectTile(m, columnBias = m.regs.d) {
  const { mem8, mem16 } = m;

  // Map row: bias the vertical counter, drop to an 8-pixel cell, flip so screen-top is the highest index (0..31).
  const objX = mem8[PLAYER_Y];
  const row = 31 - (u8(objX + 3) >> 3);
  mem8[PLAYER_TILE_ROW] = row;

  // Which map column? Bias the horizontal counter by the caller's offset plus a fixed margin.
  // That biased value is both the column source (dropped to an 8-pixel cell) and the position
  // the collector reads to tell when the object is crossing a tile boundary; keep it byte-wide.
  const objY = mem8[PLAYER_X];
  const positionAccumulator = u8(objY + columnBias + 12);
  const col = positionAccumulator >> 3;
  mem8[PLAYER_TILE_COL] = col;

  // The cell's video-RAM address: 32 cells per row, offset from the tile-map base.
  const cellPtr = VIDEO_RAM_BASE + row * 32 + col;
  mem16[PLAYER_CELL_PTR] = cellPtr;

  // Read and publish the tile currently under the object (two copies), and clear the next slot.
  mem8[NEXT_TILE] = 0;
  const tile = mem8[cellPtr];
  mem8[CUR_TILE] = tile;
  mem8[EXPECTED_TILE] = tile;

  // On the goal tile: latch that it was reached, and once the object is also past the crossing
  // position, record the crossing and hand off to the walk-forward continuation.
  if (tile === GOAL_TILE) {
    mem8[GOAL_TILE_LATCH] = tile;
    if (objY >= CROSSING_POSITION) {
      mem8[PIT_CROSS_ACTIVE] = objY;
      return advanceActorWalk(m);
    }
  }

  // Every other case: hand the tile and the object's crossing position to the loot/dig collector.
  return collectLootTile(m, tile, positionAccumulator);
}
