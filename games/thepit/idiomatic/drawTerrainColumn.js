// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawTerrainColumn — write one vertical strip of tiles up a backdrop column, then tick the
 * animation clock. The dirt/shaft backdrop refreshes one vertical strip per animation step: this
 * write starts at the column's bottom cell and copies a run of tile codes from a pattern table up
 * the tile-map, one screen row per cell, until used up (a zero run length means a full 256-cell
 * run, checked only after the first cell). It then falls through into the animation phase clock, whose return is ours.
 */

import { advanceChamberCreatureAnimation } from "./advanceChamberCreatureAnimation.js";
import { u16 } from "../../../core/int.js";

export function drawTerrainColumn(m) {
  const { regs, mem8 } = m;

  let src = regs.ix; // read cursor into the tile-pattern table
  let dst = regs.hl; // the column's bottom tile-map cell
  const rowStep = regs.de; // step to the next cell one screen row up (a negative stride)
  let remaining = regs.b; // number of cells to write (zero means a full 256-cell run)

  // Copy the run up the column, one cell per screen row; the count is tested only after each write.
  do {
    mem8[dst] = mem8[src];
    dst = u16(dst + rowStep);
    src = u16(src + 1);
    remaining = (remaining - 1 + 256) % 256;
  } while (remaining !== 0);

  // Fall through into the animation phase clock; its return goes to our caller.
  return advanceChamberCreatureAnimation(m);
}
