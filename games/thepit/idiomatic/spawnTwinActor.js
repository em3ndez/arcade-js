// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnTwinActor — spawn the two-body (primary + twin) actor once when its spawn is
 * due: paint its tile+colour figure, seed both object records, and stage its sprite
 * records for the move/animate driver.  ROM 0x3984.
 *
 * A sibling of loc_37cf/advanceOrRebuildTwinActor: the same conditional one-shot spawn shape. It
 * only fires when this actor's slot is flagged as pending — a nonzero request byte
 * at ACTOR_Y. When nothing is pending it returns immediately, touching nothing.
 * When a spawn IS pending it:
 *
 *   - Clears the request (ACTOR_Y and its twin mirror back to 0) so the spawn runs
 *     exactly once.
 *   - Stamps the actor's on-screen figure: a fixed 4-row x 2-col block of eight
 *     consecutive tiles (0xa8..0xaf, filled top-to-bottom then left-to-right) into
 *     the tilemap, all sharing one colour attribute, anchored at a fixed cell. Rows
 *     are one tilemap row (32 cells) apart.
 *   - Seeds the primary actor record at 0x810a and its mirrored twin at 0x811b to
 *     identical starting values: tile field 9, coordinates/state bytes 0, a fresh
 *     countdown timer of 180 frames, and a small per-record constant (6 primary,
 *     7 twin). The two records' start-phase bytes are set to 7 - (a low-bit slice
 *     of the shared state byte 0x8028), which staggers the actor's first action.
 *   - Hands off to stageActorSpriteRecords, which stages both freshly-seeded
 *     records into the sprite buffer; that hand-off is this routine's last act
 *     (a tail call, its result is our result).
 *
 * Memory-equivalent to the frozen oracle — equivalence-3984.test.js.
 * GATE:     captured-dispatch — every real 0x3984 entry in a 4000-frame attract run
 *           (172 total: 170 not-pending early-returns + 2 that run the full spawn
 *           body with a pending request), oracle vs this diffed on RAM. Reached in
 *           attract; body exercised on the pending-spawn dispatches.
 * LIVE-OUT: memory-only — the stamped tile+colour block and the two seeded actor
 *           records (which loc_3a4c then materialises). No live register/flag out:
 *           loc_3a4c overwrites the working registers and the whole-machine attract
 *           gate backstops the rest.
 * NAMES:    ACTOR_Y / TWIN_CLEAR (the request byte + its mirror), ACTOR_X /
 *           ACTOR_TILE / ACTOR_TIMER and TWIN_X / TWIN_TILE from ram.js. The twin
 *           timer, the twin-mirror state/phase fields, and the phase source 0x8028
 *           have no confirmed name yet and stay hex.
 */

import {
  ACTOR_ATTR,
  ACTOR_TILE,
  ACTOR_TIMER,
  ACTOR_X,
  ACTOR_Y,
  LEVEL,
  TWIN_ATTR,
  TWIN_CLEAR,
  TWIN_TILE,
  TWIN_TIMER,
  TWIN_X,
} from "./ram.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

// The eight-cell figure: a 4-row x 2-col tile block. The anchor is its bottom-left
// cell; rows sit one tilemap row (32 cells) above each other, tiles run 0xa8..0xaf.
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
  if (mem8[ACTOR_Y] === 0) return;

  // Consume the request so the spawn happens exactly once.
  mem8[ACTOR_Y] = 0;
  mem8[TWIN_CLEAR] = 0;

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
  mem8[ACTOR_TILE] = 9;
  mem8[TWIN_TILE] = 9;
  mem8[ACTOR_X] = 0;
  mem8[TWIN_X] = 0;
  mem8[ACTOR_ATTR] = 0; // primary state byte
  mem8[TWIN_ATTR] = 0; // twin state byte
  mem8[0x8117] = 0; // primary sub-state
  mem8[0x8128] = 0; // twin sub-state
  mem8[ACTOR_TIMER] = 180; // primary countdown, ~3 seconds
  mem8[TWIN_TIMER] = 180; // twin countdown
  mem8[0x811a] = 6; // primary per-record constant
  mem8[0x812b] = 7; // twin per-record constant (one higher)

  // Start phase: a low-bit slice of the shared state byte staggers the first action.
  const startPhase = 7 - (mem8[LEVEL] & 0x06);
  mem8[0x8118] = startPhase; // primary
  mem8[0x8129] = startPhase; // twin

  // Hand off to the record-to-sprite copier: it stages both freshly-seeded records
  // into the sprite buffer. Its effect is memory-only, and this is a tail hand-off,
  // so the copier's return is our return.
  return stageActorSpriteRecords(m);
}
