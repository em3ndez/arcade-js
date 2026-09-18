// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedObjectStartState — drop the tracked-object / level state block back to its fixed
 * start-of-play defaults: one of the pre-play setup calls the round (re)init chain fires before a
 * round begins. It stamps a run of work-RAM bytes with constants (nothing is read) — the probe
 * coordinate parked at its origin, a few counters given non-zero step/pacing seeds, everything
 * else cleared. Each write is a fixed constant on a distinct byte, so the result is independent of
 * the entry state and write order does not matter.
 */

import { CARVE_SEAM_LEFT, CARVE_SEAM_RIGHT, MOVE_BLOCK_FLAG, NEXT_TILE, OBJECT_MOTION_MODE, LOCKED_COLUMN, PLAYER_SPRITE_ATTR, PLAYER_STEP_Y, PLAYER_STEP_X, PLAYER_TILE_COL, PLAYER_TILE_ROW, PLAYER_Y, PLAYER_X, BOARD_END_PHASE, PLAYER_FACING, REACTION_TIMER, EXPECTED_TILE, PLAYER_ANIM_PHASE, PRIZE_GATE, PIT_CROSS_ACTIVE, TREASURE_COLLECTED, PLAYER_ACTIVE, TRANSITION_TIMER, POST_TRANSITION_MODE, CRYSTAL_COUNT, DIAMOND_COUNT, REACTION_STATE } from "./names.js";

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
    PLAYER_ANIM_PHASE, OBJECT_MOTION_MODE, PRIZE_GATE, PIT_CROSS_ACTIVE, TREASURE_COLLECTED, PLAYER_ACTIVE, LOCKED_COLUMN,
    BOARD_END_PHASE, TRANSITION_TIMER, POST_TRANSITION_MODE, CARVE_SEAM_LEFT, CARVE_SEAM_RIGHT, MOVE_BLOCK_FLAG, CRYSTAL_COUNT, DIAMOND_COUNT,
    REACTION_STATE, REACTION_TIMER, EXPECTED_TILE, NEXT_TILE,
  ]) {
    mem8[addr] = 0;
  }
}
