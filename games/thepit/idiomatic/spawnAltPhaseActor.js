// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnAltPhaseActor — bring the alt-phase actor (a primary sprite plus its shadow twin) to life
 * on its first frame, then animate it every frame after.
 *
 * The actor's per-frame entry, reached once its spawn is due; the spawn flag (BOARD_END_PHASE)
 * doubles as its state. Holding the "live" sentinel means nothing to spawn — the frame goes
 * straight to the per-frame animator. Otherwise this is the first frame: pick the start row from
 * the spawn sub-phase (row 22 for sub-phase 2, else 23), store it to the primary record and its
 * twin, mark the actor live and play the spawn sound, seed the primary and shadow records (shadow
 * trailing 16 columns right with the next tile code, an armed cadence timer, and the shared
 * paired-display byte on both), stamp the opening 2x4 tile+colour block growing upward from its
 * anchor, then hand off to the shared sprite-record stager that builds the two hardware sprites.
 */

import {
  BOARD_END_PHASE,
  ENEMY3_ATTR,
  ENEMY3_FIGURE_ANCHOR_CELL,
  ENEMY3_FIGURE_COLOUR_ANCHOR,
  ENEMY3_TILE,
  ENEMY3_TIMER,
  ENEMY3_TWIN_ATTR,
  ENEMY3_TWIN_TILE,
  ENEMY3_TWIN_X,
  ENEMY3_TWIN_Y,
  ENEMY3_X,
  ENEMY3_Y,
} from "./names.js";
import { advanceAltPhaseActor } from "./advanceAltPhaseActor.js";
import { requestSound7 } from "./requestSound7.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

const ACTIVE = 255; // spawn-flag value marking the actor already alive
const START_COLUMN = 16; // primary actor's spawn column
const SHADOW_COLUMN_OFFSET = 16; // the shadow twin trails this many columns to the right
const PRIMARY_TILE = 46; // primary actor's spawn tile
const SHADOW_TILE = 47; // shadow twin's tile (one past the primary's)
const PAIRED_DISPLAY = 151; // shared paired-display byte on both records

// The opening tile block: a 2-wide x 4-tall grid stamped into the tilemap and its
// colour map, growing upward from an anchor cell.
const BLOCK_TILE = 36;
const BLOCK_COLOUR = 144;
const VIDEO_ANCHOR = ENEMY3_FIGURE_ANCHOR_CELL; // bottom-left display cell of the block (tilemap RAM)
const COLOUR_ANCHOR = ENEMY3_FIGURE_COLOUR_ANCHOR; // matching cell in colour RAM
const TILEMAP_ROW = 32;
const BLOCK_ROWS = 4;
const BLOCK_COLS = 2;

export function spawnAltPhaseActor(m) {
  const { mem8 } = m;

  const phase = mem8[BOARD_END_PHASE];

  // Already alive: skip the spawn, just animate this frame.
  if (phase === ACTIVE) return advanceAltPhaseActor(m);

  // First frame. The start row comes from the spawn sub-phase.
  const startRow = phase === 2 ? 22 : 23;
  mem8[ENEMY3_Y] = startRow;
  mem8[ENEMY3_TWIN_Y] = startRow;

  // Mark the actor live so later frames animate, and play the spawn sound.
  mem8[BOARD_END_PHASE] = ACTIVE;
  requestSound7(m);

  // Seed the primary + shadow-twin records.
  mem8[ENEMY3_X] = START_COLUMN;
  mem8[ENEMY3_TWIN_X] = START_COLUMN + SHADOW_COLUMN_OFFSET;
  mem8[ENEMY3_TILE] = PRIMARY_TILE;
  mem8[ENEMY3_TWIN_TILE] = SHADOW_TILE;
  mem8[ENEMY3_TIMER] = 1; // cadence timer, armed
  mem8[ENEMY3_ATTR] = PAIRED_DISPLAY;
  mem8[ENEMY3_TWIN_ATTR] = PAIRED_DISPLAY;

  // Stamp the opening tile+colour block into the display, growing upward from the anchor.
  for (let row = 0; row < BLOCK_ROWS; row++) {
    const up = row * TILEMAP_ROW;
    for (let col = 0; col < BLOCK_COLS; col++) {
      mem8[VIDEO_ANCHOR - up + col] = BLOCK_TILE;
      mem8[COLOUR_ANCHOR - up + col] = BLOCK_COLOUR;
    }
  }

  // Build the two hardware sprite records and return through the shared stager.
  return stageActorSpriteRecords(m);
}
