// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagObjectTargetOverlap — flag whether the freshly-placed target cell coincides with the
 * tracked object, then hand off to build the cell's record.
 *
 * The dig/projectile-spawn path has just painted a target cell at (HAZARD_X, HAZARD_Y), and
 * the cell's per-tick countdown handler also drops in here while the cell is alive. This
 * shared tail decides whether the tracked object sits on that cell, publishes a 0/1 flag to
 * MOVE_BLOCK_FLAG, then continues into building the cell's 4-byte record. Overlap needs BOTH
 * axes: the cell's row plus 12 must equal the object's row, AND the object's X must fall in
 * the 8-pixel band just right of the cell's X (cell strictly left, object no more than 8 past).
 */

import { u8 } from "../../../core/int.js";
import { PLAYER_Y, PLAYER_X, HAZARD_X, HAZARD_Y, MOVE_BLOCK_FLAG } from "./names.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

export function flagObjectTargetOverlap(m) {
  const { mem8 } = m;

  const objectRow = mem8[PLAYER_X];
  const objectX = mem8[PLAYER_Y];
  const cellX = mem8[HAZARD_X];

  // Both axes must coincide for the cell and the object to count as overlapping.
  const rowsAlign = u8(mem8[HAZARD_Y] + 12) === objectRow;
  const objectRightOfCell = cellX < objectX;
  const objectWithinBand = u8(cellX + 8) >= objectX;
  const overlaps = rowsAlign && objectRightOfCell && objectWithinBand;

  mem8[MOVE_BLOCK_FLAG] = overlaps ? 1 : 0;

  // Build the placed cell's sprite record and continue; its return unwinds to our caller.
  return stageDigObjectSpriteRecord(m);
}
