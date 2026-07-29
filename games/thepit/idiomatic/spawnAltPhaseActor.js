// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnAltPhaseActor — bring the alt-phase actor (a primary sprite + its shadow twin)
 * to life on its first frame, then animate it every frame after.  ROM 0x37cf.
 *
 * The alt-phase actor's per-frame entry point, reached once its spawn becomes due. Its
 * spawn flag doubles as the state:
 *
 *   - Already active (flag holds the "live" sentinel): nothing to spawn — hand the
 *     frame straight to the per-frame animator.
 *   - Not yet active (flag holds the spawn sub-phase): this is the first frame. Build
 *     the actor from scratch, mark it live, and draw its opening pose.
 *
 * The first-frame spawn:
 *   - Chooses the actor's start row from the spawn sub-phase (row 22 for sub-phase 2,
 *     row 23 otherwise), storing it to the primary record and its twin mirror.
 *   - Marks the actor live so every later frame animates instead of respawning, and
 *     asks the sound driver to play the spawn sound.
 *   - Seeds the primary and twin (shadow) records: the primary parked at its start
 *     column, the shadow trailing 16 columns to its right with the next tile code, a
 *     freshly armed cadence timer, and the shared paired-display byte on both.
 *   - Stamps the actor's opening 2-wide x 4-tall tile+colour block into the display,
 *     growing upward from its anchor cell.
 *   - Hands off to the shared sprite-record stager, which builds the two hardware
 *     sprite entries the actor draws with.
 *
 * Memory-equivalent to the frozen oracle — equivalence-37cf.test.js.
 * GATE:     memory-equivalence (RAM minus the dead stack scratch). Real captured
 *           attract dispatches exercise the already-active hand-off; crafted entries
 *           force the first-frame spawn and both start-row sub-phases (attract keeps
 *           the actor already-active). Teeth: a wrong shadow-column-offset twin.
 * LIVE-OUT: memory-only — the seeded actor/twin records, the spawn flag, the queued
 *           sound command, the stamped tile+colour block, and the two staged sprite
 *           records. The registers/flags and the return address the oracle path pushes
 *           for the sound call are dead: the caller chain is all tail-jumps that read
 *           no returned register.
 * NAMES:    BOARD_END_PHASE, ENEMY3_X/ENEMY3_Y/ENEMY3_TILE/ENEMY3_TIMER, ENEMY3_TWIN_X/ENEMY3_TWIN_TILE/
 *           ENEMY3_TWIN_Y from ram.js. Kept hex: 0x810c/0x811d (the paired-display byte on
 *           each record, unnamed in ram.js) and the video/colour anchor cells
 *           0x93a3/0x8ba3 (hardware display addresses).
 */

import {
  BOARD_END_PHASE, ENEMY3_X, ENEMY3_Y, ENEMY3_TILE, ENEMY3_TIMER,
  ENEMY3_TWIN_X, ENEMY3_TWIN_TILE, ENEMY3_TWIN_Y,
} from "./ram.js";
import { advanceAltPhaseActor } from "./advanceAltPhaseActor.js";
import { requestSound7 } from "./requestSound7.js";
import { stageActorSpriteRecords } from "./stageActorSpriteRecords.js";

const ACTIVE = 255; // spawn-flag value marking the actor already alive
const START_COLUMN = 16; // primary actor's spawn column
const SHADOW_COLUMN_OFFSET = 16; // the shadow twin trails this many columns to the right
const PRIMARY_TILE = 46; // primary actor's spawn tile
const SHADOW_TILE = 47; // shadow twin's tile (one past the primary's)
const PAIRED_DISPLAY = 151; // shared paired-display byte on both records
const PRIMARY_PAIRED = 0x810c; // primary record's paired-display byte (unnamed in ram.js)
const TWIN_PAIRED = 0x811d; // twin record's paired-display byte (unnamed in ram.js)

// The opening tile block: a 2-wide x 4-tall grid stamped into the tilemap and its
// colour map, growing upward from an anchor cell.
const BLOCK_TILE = 36;
const BLOCK_COLOUR = 144;
const VIDEO_ANCHOR = 0x93a3; // bottom-left display cell of the block (tilemap RAM)
const COLOUR_ANCHOR = 0x8ba3; // matching cell in colour RAM
const TILEMAP_ROW = 32; // cells per tilemap row
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
  mem8[ENEMY3_TWIN_Y] = startRow; // twin mirrors the primary's row

  // Mark the actor live so later frames animate, and play the spawn sound.
  mem8[BOARD_END_PHASE] = ACTIVE;
  requestSound7(m);

  // Seed the primary + shadow-twin records.
  mem8[ENEMY3_X] = START_COLUMN;
  mem8[ENEMY3_TWIN_X] = START_COLUMN + SHADOW_COLUMN_OFFSET;
  mem8[ENEMY3_TILE] = PRIMARY_TILE;
  mem8[ENEMY3_TWIN_TILE] = SHADOW_TILE;
  mem8[ENEMY3_TIMER] = 1; // cadence timer, armed
  mem8[PRIMARY_PAIRED] = PAIRED_DISPLAY;
  mem8[TWIN_PAIRED] = PAIRED_DISPLAY;

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
