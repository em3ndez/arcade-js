// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceOrRebuildTwinActor — per-frame gate for the two-body actor: keep it moving while it is in
 * the high half of the field, otherwise rebuild it at the start edge and redraw.
 * A sibling of the same actor family — the same 2-wide by 4-tall tile figure anchored at the same
 * display cell. Each frame it forks on the actor's coordinate (ENEMY3_X):
 *   - High half (128 or above): still on-screen, so hand the frame to the cadence/move path,
 *     whose result carries back through to the caller.
 *   - Below it: the actor ran off the low edge, so rebuild it — park ENEMY3_X at the start edge
 *     (240) with the shadow twin trailing 16 ahead, reset both bodies' row and tiles, stamp the
 *     shared paired-display byte and the two primary-only record fields, arm the cadence timer,
 *     then re-stamp the actor's eight-cell figure (consecutive tile codes, one shared colour).
 */

import {
  ENEMY3_STEP_X,
  ENEMY3_STEP_Y,
  ENEMY3_TILE,
  ENEMY3_TIMER,
  ENEMY3_X,
  ENEMY3_Y,
  ENEMY3_TWIN_Y,
  ENEMY3_TWIN_TILE,
  ENEMY3_TWIN_X,
  ENEMY3_ATTR,
  ENEMY3_TWIN_ATTR,
} from "./names.js";
import { paceActorCadence } from "./paceActorCadence.js";

const PAIRED_DISPLAY = 147; // value stamped on both paired-display bytes

// The actor's figure: a 2-wide x 4-tall tile block re-stamped into the tilemap and its
// colour map, anchored at a fixed display cell. The eight cells take consecutive tile
// codes 184..191 in a fixed paint order (the offsets below), all sharing one colour.
const VIDEO_ANCHOR = 0x93a3; // anchor display cell (tilemap RAM)
const COLOUR_ANCHOR = 0x8ba3; // matching cell in colour RAM
const FIRST_TILE = 184;
const FIGURE_COLOUR = 151;
// Cell offsets from the anchor, in paint order; the tile code steps up by one per cell.
const CELL_OFFSETS = [-32, -31, 0, 1, -96, -95, -64, -63];

export function advanceOrRebuildTwinActor(m) {
  const { mem8 } = m;

  // While the actor is still in the high half of the field, keep it moving.
  if (mem8[ENEMY3_X] >= 128) return paceActorCadence(m);

  // The actor ran off the low edge: rebuild the primary body and its shadow twin.
  mem8[ENEMY3_X] = 240; // coordinate parked back at the start edge
  mem8[ENEMY3_TWIN_X] = (240 + 16) % 256; // twin trails 16 ahead, wrapping to 0
  mem8[ENEMY3_Y] = 31;
  mem8[ENEMY3_TWIN_Y] = 31;
  mem8[ENEMY3_TWIN_TILE] = 42;
  mem8[ENEMY3_TILE] = 43;
  mem8[ENEMY3_STEP_X] = 0; // the two primary-only record fields
  mem8[ENEMY3_STEP_Y] = 1;
  mem8[ENEMY3_TIMER] = 1; // cadence timer, armed to fire next tick
  mem8[ENEMY3_ATTR] = PAIRED_DISPLAY;
  mem8[ENEMY3_TWIN_ATTR] = PAIRED_DISPLAY;

  // Re-stamp the actor's eight-cell figure into the display.
  let tile = FIRST_TILE;
  for (const offset of CELL_OFFSETS) {
    mem8[VIDEO_ANCHOR + offset] = tile;
    mem8[COLOUR_ANCHOR + offset] = FIGURE_COLOUR;
    tile += 1;
  }
}
