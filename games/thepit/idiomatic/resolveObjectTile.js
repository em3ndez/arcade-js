// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveObjectTile — locate the tracked object's tile cell, read the tile under it, and hand the
 * object to the matching per-frame handler.  ROM 0x186f.
 *
 * From the object's two position counters (plus a caller-supplied horizontal bias) it works
 * out which tile cell of the on-screen map the object currently occupies: it derives the row
 * and column cell coordinates, builds the video-RAM address of that cell, and reads the tile
 * sitting there. It publishes the cell address and the tile (two copies) so the draw code and
 * the downstream handlers can use them, and clears the "next tile" slot.
 *
 * Then it routes the object:
 *   - On any ordinary tile it hands off to the loot/dig collector, passing the tile code and
 *     the biased horizontal position — the collector only acts right as the object crosses a
 *     tile boundary, which that position tells it.
 *   - The moment the object is standing on the goal tile it latches that the goal was reached;
 *     and once it is also past the crossing position it records where it crossed and hands off
 *     to the walk-forward continuation instead. (Standing on the goal tile before the crossing
 *     position still routes to the collector, with the goal already latched.)
 *
 * The handler it hands off to is the object's whole remaining work this frame; that handler's
 * return unwinds to this routine's caller, so handing off is this routine's own return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-186f.test.js.
 * GATE:     RAM-only over real captured attract dispatches (resolveObjectTile runs ~500x in a plain
 *           boot/attract run, reached from the movement/state dispatcher) + crafted goal-tile
 *           entries for the goal / crossing arms attract never reaches. Excludes the dead stack
 *           scratch the still-oracle comparison run parks below the entry stack pointer (the
 *           idiomatic handlers are stack-free). Teeth: wrong row cell, wrong published tile,
 *           skipped goal latch.
 * LIVE-OUT: memory-only — the row/column cell coordinates, the cell address, the published
 *           under-tile (both copies) and cleared next-tile slot, the goal latches, plus
 *           whatever the handoff handler writes. No live registers of its own; the horizontal
 *           bias is a genuine register live-in surfaced as the columnBias parameter.
 * NAMES:    PLAYER_Y, PLAYER_X, PLAYER_TILE_ROW, PLAYER_TILE_COL, PLAYER_CELL_PTR, NEXT_TILE, CUR_TILE,
 *           GOAL_TILE_LATCH, PIT_CROSS_ACTIVE from ram.js; 0x80a7 is EXPECTED_TILE (used
 *           here as the second under-tile copy); 0x9000 (video-RAM base) stays hex.
 */

import {
  PLAYER_CELL_PTR,
  CUR_TILE,
  EXPECTED_TILE,
  PIT_CROSS_ACTIVE,
  GOAL_TILE_LATCH,
  NEXT_TILE,
  PLAYER_TILE_COL,
  PLAYER_TILE_ROW,
  PLAYER_Y,
  PLAYER_X,
} from "./ram.js";
import { u8 } from "../../../core/int.js";
import { collectLootTile } from "./collectLootTile.js";
import { advanceActorWalk } from "./advanceActorWalk.js";

// Base address of the on-screen tile map in video RAM; an object's cell is an offset from here.
const VRAM_BASE = 0x9000;

// The special tile marking the goal the object crosses toward.
const GOAL_TILE = 39;
// Horizontal position at/after which standing on the goal tile counts as having crossed.
const CROSSING_POSITION = 83;

export function resolveObjectTile(m, columnBias = m.regs.d) {
  const { mem8, mem16 } = m;

  // Which map row is the object on? Bias the vertical counter, drop it to an 8-pixel cell, and
  // flip it so screen-top is the highest index (the map is 32 rows tall, indices 0..31).
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
  const cellPtr = VRAM_BASE + row * 32 + col;
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
