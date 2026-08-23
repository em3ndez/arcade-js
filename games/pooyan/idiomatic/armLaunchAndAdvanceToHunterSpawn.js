// SPDX-License-Identifier: GPL-3.0-only
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  LAUNCH_ARMED_FLAG,
  LANE_SPAWN_COUNTDOWN,
  LAUNCH_ARM_LATCH,
  STAGE_COUNTDOWN,
  ARROW_Y,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  LAUNCH_STATE,
  LAUNCH_FLIP_COUNTDOWN,
  GAME_ACTIVE_FLAG,
  PLAY_MODE_LATCH,
  LAUNCH_HUD_TILE,
  LAUNCH_ARM_LATCH_SEED,
  LAUNCH_TILE_VRAM,
  LAUNCH_TILE_SRC,
} from "./names.js";

const HIT_BIT = 0x02; // hunter-hit bit tested in the target records
const ARROW_Y_GATE = 0x3c; // minimum arrow height before the launch may advance
const HUD_LIT_TILE = 0x6f; // tile written to light the launch HUD cell
const FLIP_RESEED = 0x08; // reseed value for the tile-flip countdown

/**
 * armLaunchAndAdvanceToHunterSpawn — launch state 0: arm the launch flag, gate on the arrow, then advance.
 *
 * Arms the launch flag once its preconditions hold (bumping the arm latch when the lane
 * countdown is up and the latch is still clear, otherwise requiring a stage value that is
 * nonzero and a multiple of eight). It then returns unless the arrow has risen far enough
 * and neither hunter-target record is flagged hit. Clearing those gates it steps the
 * launch state, reseeds the flip countdown, may light a HUD cell, refreshes the arm latch
 * from its seed, and tail-blits the launch tile.
 *
 * LIVE-OUT: memory only — the state cells and the blitted tile square; the tail blit also
 * sets HL as a side effect, but this dispatched handler's caller does not consume it.
 */
export function armLaunchAndAdvanceToHunterSpawn(m) {
  const { mem8 } = m;

  // -- Arm the launch flag once --
  if (mem8[LAUNCH_ARMED_FLAG] === 0) {
    let checkStage = true;
    if (mem8[LANE_SPAWN_COUNTDOWN] !== 0 && mem8[LAUNCH_ARM_LATCH] === 0) {
      mem8[LAUNCH_ARM_LATCH] = mem8[LAUNCH_ARM_LATCH] + 1;
      checkStage = false;
    }
    if (checkStage) {
      const stage = mem8[STAGE_COUNTDOWN];
      if (stage === 0) return;
      if ((stage & 0x07) !== 0) return;
    }
    mem8[LAUNCH_ARMED_FLAG] = 0x01;
  }

  // -- Gate on arrow height and the two hunter-hit bits --
  if (mem8[ARROW_Y] < ARROW_Y_GATE) return;
  if (mem8[ENEMY_TARGET_REC0] & HIT_BIT) return;
  if (mem8[ENEMY_TARGET_REC1] & HIT_BIT) return;

  // -- Advance the state and refresh its fields --
  mem8[LAUNCH_STATE] = mem8[LAUNCH_STATE] + 1;
  mem8[LAUNCH_FLIP_COUNTDOWN] = FLIP_RESEED;

  if (mem8[GAME_ACTIVE_FLAG] === 0 && (mem8[PLAY_MODE_LATCH] | mem8[LAUNCH_ARMED_FLAG]) !== 0) {
    mem8[LAUNCH_HUD_TILE] = HUD_LIT_TILE;
  }

  const seed = mem8[LAUNCH_ARM_LATCH_SEED];
  if (seed !== 0) mem8[LAUNCH_ARM_LATCH] = seed;

  return blit2x2TileBlock(m, LAUNCH_TILE_VRAM, LAUNCH_TILE_SRC);
}
