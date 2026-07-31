// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectStartState — drop the tracked-object / level state block back to its
 * fixed start-of-play defaults.  ROM 0x1362.
 *
 * One of the pre-play setup calls the round/play (re)init chain fires before a round
 * begins (initRoundAndEnterMainLoop). It stamps a whole run of work-RAM bytes with constants — nothing
 * is read — so the object always starts a round in the same pose:
 *
 *   - The tracked-object probe coordinate is parked at its origin (left column, a
 *     fixed start row) and the object's sprite code set to its default.
 *   - A handful of block counters get fixed non-zero start values (step / pacing
 *     seeds); only their start values are pinned here, not their individual roles.
 *   - Everything else in the block — the spawn-phase flag, the vertical-move gate,
 *     the unnamed status bytes, and the tile-classifier scratch — starts cleared.
 *
 * Every write is a fixed constant landing on a distinct byte, so the resulting state
 * is independent of the entry state and write order does not matter.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1362.test.js.
 * GATE:     crafted-entry — never dispatched during attract (it runs only from the
 *           gameplay round-init chain, which attract never reaches), so it is
 *           validated on real captured attract states. It reads nothing, so any
 *           realistic state proves it; a sentinel-preset entry makes every write
 *           observable, and the teeth twin is caught.
 * LIVE-OUT: memory-only — the seeded work-RAM bytes. The round-init caller consumes
 *           no register.
 * NAMES:    PLAYER_Y, PLAYER_X, PLAYER_FACING, BOARD_END_PHASE, MOVE_BLOCK_FLAG, NEXT_TILE, CARVE_SEAM_LEFT,
 *           CARVE_SEAM_RIGHT from ram.js. The remaining counters and status/scratch bytes
 *           in the same block are not yet named, so their addresses stay hex.
 */

import {
  CARVE_SEAM_LEFT,
  CARVE_SEAM_RIGHT,
  MOVE_BLOCK_FLAG,
  NEXT_TILE,
  OBJECT_MOTION_MODE,
  LOCKED_COLUMN,
  PLAYER_SPRITE_ATTR,
  PLAYER_STEP_Y,
  PLAYER_STEP_X,
  PLAYER_TILE_COL,
  PLAYER_TILE_ROW,
  PLAYER_Y,
  PLAYER_X,
  BOARD_END_PHASE,
  PLAYER_FACING,
} from "./ram.js";

export function seedObjectStartState(m) {
  const { mem8 } = m;

  // Park the tracked-object probe at its start position and set the default sprite.
  mem8[PLAYER_Y] = 0; // start column — left edge
  mem8[PLAYER_X] = 35; // start row
  mem8[PLAYER_FACING] = 50; // default sprite / animation code

  // Fixed non-zero start values for the block's counters.
  mem8[PLAYER_SPRITE_ATTR] = 2;
  mem8[PLAYER_STEP_Y] = 1;
  mem8[PLAYER_STEP_X] = 1;
  mem8[0x8070] = 1;
  mem8[PLAYER_TILE_COL] = 5;
  mem8[PLAYER_TILE_ROW] = 25;

  // Everything else in the block starts empty: the spawn-phase flag, the
  // vertical-move gate, the unnamed status bytes, and the tile-classifier scratch.
  for (const addr of [
    0x801a, OBJECT_MOTION_MODE, 0x8076, 0x8077, 0x8078, 0x8079, LOCKED_COLUMN,
    BOARD_END_PHASE, 0x807c, 0x807d, CARVE_SEAM_LEFT, CARVE_SEAM_RIGHT, MOVE_BLOCK_FLAG, 0x8081, 0x8082,
    0x80a2, 0x80a4, 0x80a7, NEXT_TILE,
  ]) {
    mem8[addr] = 0;
  }
}
