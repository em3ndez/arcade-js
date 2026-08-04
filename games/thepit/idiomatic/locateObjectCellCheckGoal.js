// SPDX-License-Identifier: GPL-3.0-only
/**
 * locateObjectCellCheckGoal — locate the object's tilemap cell, latch a goal crossing if the goal is just ahead,
 * else resolve the tile under it.  ROM 0x14cd.
 *
 * The positioning front of the tile-under-object collision path, entered from the object dispatcher
 * (stepObjectRowFlipped) with the object's screen row. It first turns the object's row + column coordinates into
 * the address of the tilemap cell the object stands on:
 *
 *   - The column is the object's row coordinate plus a small rounding bias; the top bits (÷8) are the
 *     tile column, published for the tile code that follows, and the whole biased value's low 3 bits
 *     are the object's sub-tile offset within the cell.
 *   - The cell address is the video-RAM base plus (screen row × the 32-cell row stride) plus that tile
 *     column. It is published as the object's current cell pointer.
 *
 * It clears the "tile ahead" scratch, then peeks at the cell one step ahead: if that cell holds the
 * goal tile AND the object is squarely grid-aligned on its cross axis, the object has just reached the
 * goal — it latches both goal flags and steps the walk animation.
 *
 * Every other case hands the whole step to the tile-under-object resolver, which collects loot the
 * object is standing squarely on, or resolves how it meets the terrain (hold against a solid, push a
 * block, or walk on) — that resolver's result is this routine's result.
 *
 * Kept as locateObjectCellCheckGoal: its role is clear but its resolver siblings (collectAlignedLootElseResolveTile / resolveObjectTerrainStep / resolveActorTerrainStep) and
 * caller (stepObjectRowFlipped) stay neutral too — the object's move axis is contested under the rotated display
 * and which object this path serves is not yet pinned — so a single effect-verb would over-claim.
 *
 * Memory-equivalent to the frozen oracle — equivalence-14cd.test.js.
 * GATE:     strict-ish (RAM minus a dead stack-top window); reached in attract (61 dispatches / 4000
 *           frames). Validated on every real captured dispatch, plus crafted entries for the arms the
 *           demo never drives: the goal-ahead latch, and the tile-under sweep over all 256 ids across
 *           every sub-offset (the delegated loot/push arms are covered by collectAlignedLootElseResolveTile's own gate). The
 *           diff excludes the [SP-16, SP) scratch the oracle's loot-award calls park below the entry
 *           stack pointer — the idiomatic cascade is stack-free.
 * LIVE-OUT: memory-only — the published tile column (PLAYER_TILE_COL) and cell pointer (PLAYER_CELL_PTR),
 *           the cleared ahead-tile scratch (NEXT_TILE), the two goal latches, and whatever the tile
 *           resolver or walk step leaves. No register live-out (the walk path's phase is set inside
 *           advanceObjectWalkFrame, covered by its own gate).
 * NAMES:    PLAYER_X, PLAYER_Y, PLAYER_TILE_COL, PLAYER_CELL_PTR, NEXT_TILE, GOAL_TILE_LATCH,
 *           PIT_CROSS_ACTIVE from names.js. The tile classification and its ROM tables live in the
 *           resolver collectAlignedLootElseResolveTile.
 *
 * PURPOSE [guess]: "Object"=downstream vocab; same-entity caveat (writes PLAYER_CELL_PTR).
 */

import { u8 } from "../../../core/int.js";
import {
  PLAYER_X,
  PLAYER_Y,
  PLAYER_TILE_COL,
  PLAYER_CELL_PTR,
  NEXT_TILE,
  GOAL_TILE_LATCH,
  PIT_CROSS_ACTIVE,
} from "./names.js";
import { collectAlignedLootElseResolveTile } from "./collectAlignedLootElseResolveTile.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";

const VRAM_BASE = 0x9000; // video-RAM base the tilemap cells hang off
const ROW_STRIDE = 32; // cells per tilemap row
const COLUMN_BIAS = 5; // rounding bias folded into the row coordinate before the ÷8 tile-column split
const ALIGN_BIAS = 3; // rounding bias for the cross-axis grid-alignment test
const GOAL_TILE = 39; // the tile id the object crosses at the goal

export function locateObjectCellCheckGoal(m, row = m.regs.h) {
  const { mem8, mem16 } = m;

  // Biased column: the object's row coordinate plus a rounding bias. Its low 3 bits are the object's
  // sub-tile offset within the cell; the rest (÷8) is the tile column, published for the tile code.
  const column = u8(mem8[PLAYER_X] + COLUMN_BIAS);
  mem8[PLAYER_TILE_COL] = column >> 3;

  // The cell the object stands on: video-RAM base + (screen row × row stride) + tile column.
  const cellPtr = VRAM_BASE + row * ROW_STRIDE + (column >> 3);
  mem16[PLAYER_CELL_PTR] = cellPtr;

  // Start the "tile ahead" scratch clear before classifying anything.
  mem8[NEXT_TILE] = 0;

  // Goal crossing: if the cell one step ahead is the goal tile and the object is squarely grid-aligned
  // on its cross axis, the object has just reached the goal — latch both goal flags and walk on.
  const aheadTile = mem8[cellPtr + 1];
  const crossAxisAligned = ((mem8[PLAYER_Y] + ALIGN_BIAS) & 7) === 0;
  if (aheadTile === GOAL_TILE && crossAxisAligned) {
    mem8[GOAL_TILE_LATCH] = 1;
    mem8[PIT_CROSS_ACTIVE] = 1;
    return advanceObjectWalkFrame(m);
  }

  // Otherwise resolve the tile under the object (collect loot it stands squarely on, or resolve the
  // terrain) — that resolver's result is this routine's result.
  return collectAlignedLootElseResolveTile(m, column, cellPtr);
}
