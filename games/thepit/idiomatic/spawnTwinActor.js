// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnTwinActor — spawn the two-body (primary + twin) actor once when its spawn is due: paint its
 * tile-and-colour figure, seed both object records, and stage its sprite records for the driver.
 *
 * A sibling of the conditional one-shot spawns: it fires only when this actor's slot is flagged
 * pending — a nonzero request byte at ENEMY3_Y — and otherwise returns at once, touching nothing.
 * When a spawn is pending it clears the request (ENEMY3_Y and its twin mirror back to 0) so it runs
 * exactly once; stamps the actor's figure — a fixed 4-row by 2-col block of eight consecutive tiles
 * sharing one colour attribute, anchored at a fixed cell with rows one tilemap row apart; seeds the
 * primary actor record and its mirrored twin to identical start values (tile field 9, coordinates
 * and state 0, a fresh 180-frame countdown, and a small per-record constant); and sets both
 * start-phase bytes to 7 minus a low-bit slice of LEVEL, staggering the actor's first action. It
 * ends by handing off to stageActorSpriteRecords, which stages both freshly-seeded records into the
 * sprite buffer — a tail call whose result is this routine's result.
 */

import {
  ENEMY3_ATTR,
  ENEMY3_TILE,
  ENEMY3_TIMER,
  ENEMY3_X,
  ENEMY3_Y,
  ENEMY3_STATE,
  ENEMY3_MOVE_PERIOD,
  ENEMY3_TARGET_COL,
  LEVEL,
  ENEMY3_TWIN_ATTR,
  ENEMY3_TWIN_Y,
  ENEMY3_TWIN_TILE,
  ENEMY3_TWIN_TIMER,
  ENEMY3_TWIN_X,
  ENEMY3_TWIN_STATE,
  ENEMY3_TWIN_MOVE_PERIOD,
  ENEMY3_TWIN_TARGET_COL,
} from "./names.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

// The eight-cell figure: a 4-row x 2-col tile block anchored at its bottom-left cell; rows sit one
// tilemap row (32 cells) apart, tiles run consecutively from FIRST_TILE.
const VIDEO_ANCHOR = 0x90e4; // tilemap RAM
const COLOR_ANCHOR = 0x88e4; // colour-attribute RAM
const ROW_STRIDE = 32; // one tilemap row
const FIGURE_ROWS = 4;
const FIGURE_COLS = 2;
const FIRST_TILE = 0xa8;
const FIGURE_COLOR = 0x93;

export function spawnTwinActor(m) {
  const { mem8 } = m;

  // Only spawn when this actor's slot is flagged pending; otherwise do nothing.
  if (mem8[ENEMY3_Y] === 0) return;

  // Consume the request so the spawn happens exactly once.
  mem8[ENEMY3_Y] = 0;
  mem8[ENEMY3_TWIN_Y] = 0;

  // Draw the figure: eight consecutive tiles, one shared colour, top row first.
  let tile = FIRST_TILE;
  for (let row = FIGURE_ROWS - 1; row >= 0; row--) {
    for (let col = 0; col < FIGURE_COLS; col++) {
      const offset = col - row * ROW_STRIDE;
      mem8[VIDEO_ANCHOR + offset] = tile;
      mem8[COLOR_ANCHOR + offset] = FIGURE_COLOR;
      tile += 1;
    }
  }

  // Seed the primary actor record and its mirrored twin to identical start values.
  mem8[ENEMY3_TILE] = 9;
  mem8[ENEMY3_TWIN_TILE] = 9;
  mem8[ENEMY3_X] = 0;
  mem8[ENEMY3_TWIN_X] = 0;
  mem8[ENEMY3_ATTR] = 0; // primary state byte
  mem8[ENEMY3_TWIN_ATTR] = 0; // twin state byte
  mem8[ENEMY3_STATE] = 0; // primary sub-state
  mem8[ENEMY3_TWIN_STATE] = 0; // twin sub-state
  mem8[ENEMY3_TIMER] = 180; // primary countdown, ~3 seconds
  mem8[ENEMY3_TWIN_TIMER] = 180; // twin countdown
  mem8[ENEMY3_TARGET_COL] = 6; // primary per-record constant
  mem8[ENEMY3_TWIN_TARGET_COL] = 7; // twin per-record constant (one higher)

  // Start phase: a low-bit slice of the shared state byte staggers the first action.
  const startPhase = 7 - (mem8[LEVEL] & 0x06);
  mem8[ENEMY3_MOVE_PERIOD] = startPhase; // primary
  mem8[ENEMY3_TWIN_MOVE_PERIOD] = startPhase; // twin

  // Tail hand-off to the record-to-sprite copier; its memory-only return is our return.
  return stageActorSpriteRecords(m);
}
