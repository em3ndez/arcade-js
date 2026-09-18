// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceDigTarget — advance the dig target one step and route on the tile it now covers:
 * embed it into the terrain when it reaches solid ground, else re-stage its sprite. The
 * per-tick continuation for the dig target (the loot cell the player is tunnelling toward):
 * each tick it steps the target along its travel axis and stores the new position, works out
 * the tile cell it now covers (cross-axis position picks the map row from the far edge, the
 * stepped axis the column) and leaves it as the live carve cursor, then reads the tile a fixed
 * step ahead — solid ground embeds, anything else keeps going and rebuilds the sprite record.
 * The terrain codes and the on-screen axis stay open, so the name claims only the advance.
 */

import { HAZARD_X, HAZARD_Y, CARVE_CELL_PTR } from "./names.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { u8 } from "../../../core/int.js";
import { landDigTarget } from "./landDigTarget.js";

// Base of the on-screen tile map in video RAM; a cell is an offset from here.
const VRAM_BASE = 0x9000;

export function advanceDigTarget(m) {
  const { mem8, mem16 } = m;

  // Cross-axis position -> map row, measured from the far edge (32 rows, 0..31).
  const row = 31 - (mem8[HAZARD_X] >> 3);

  const advancedY = mem8[HAZARD_Y] + 1;
  mem8[HAZARD_Y] = advancedY;

  // The cell the target now covers; the probe reads one step further along the axis.
  const col = u8(advancedY + 1) >> 3;
  const cell = VRAM_BASE + row * 32 + col;
  mem16[CARVE_CELL_PTR] = cell; // leave it as the live carve cursor

  const aheadTile = mem8[cell - 30]; // the tile a fixed step ahead of the target's cell

  // Solid-ground codes embed the target at that cell; anything else keeps going and rebuilds.
  if (aheadTile === 42 || aheadTile === 43 || aheadTile === 65) return landDigTarget(m, cell);
  return stageDigObjectSpriteRecord(m);
}
