// SPDX-License-Identifier: GPL-3.0-only
/**
 * locateObjectCellCheckGoal — locate the object's tilemap cell, latch a goal crossing if the goal is just ahead, else resolve the tile under it.
 *
 * The positioning front of the tile-under-object collision path, entered from the object
 * dispatcher with the object's screen row. It turns the object's row + column into the
 * address of the tilemap cell it stands on: the column is the row coordinate plus a small
 * rounding bias, its top bits (÷8) the published tile column and its low 3 bits the sub-tile
 * offset; the cell address is the video base plus (row × the 32-cell stride) plus that tile
 * column, published as the current cell pointer. It clears the "tile ahead" scratch, then
 * peeks one cell ahead: if that holds the goal tile and the object is grid-aligned on its
 * cross axis, it has reached the goal — latch both goal flags and step the walk animation.
 * Otherwise it hands the step to the tile-under-object resolver (collect loot, or resolve
 * terrain), whose result is this routine's result. Move axis and served object stay unpinned.
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

  // Biased column: row coordinate + rounding bias; low 3 bits are the sub-tile offset, top bits the tile column.
  const column = u8(mem8[PLAYER_X] + COLUMN_BIAS);
  mem8[PLAYER_TILE_COL] = column >> 3;

  // The cell the object stands on: video base + (row × stride) + tile column.
  const cellPtr = VRAM_BASE + row * ROW_STRIDE + (column >> 3);
  mem16[PLAYER_CELL_PTR] = cellPtr;

  // Start the "tile ahead" scratch clear before classifying anything.
  mem8[NEXT_TILE] = 0;

  // Goal crossing: cell ahead is the goal tile and the object is cross-axis aligned — latch and walk on.
  const aheadTile = mem8[cellPtr + 1];
  const crossAxisAligned = ((mem8[PLAYER_Y] + ALIGN_BIAS) & 7) === 0;
  if (aheadTile === GOAL_TILE && crossAxisAligned) {
    mem8[GOAL_TILE_LATCH] = 1;
    mem8[PIT_CROSS_ACTIVE] = 1;
    return advanceObjectWalkFrame(m);
  }

  // Otherwise resolve the tile under the object; that resolver's result is ours.
  return collectAlignedLootElseResolveTile(m, column, cellPtr);
}
