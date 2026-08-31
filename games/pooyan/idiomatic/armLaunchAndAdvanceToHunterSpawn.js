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

// -- Local ROM constants (the literal values this handler compares and writes) --
const HIT_BIT = 0x02; // bit 1 of a hunter-target record's status byte: set once that target has been hit
const ARROW_Y_GATE = 0x3c; // the arrow's height byte must reach this before the launch may advance a state
const HUD_LIT_TILE = 0x6f; // tile code that lights the status-panel launch cell (its blanked code is a different tile)
const FLIP_RESEED = 0x08; // value the arrow's tile-flip animation countdown is reloaded to as the launch advances

/**
 * armLaunchAndAdvanceToHunterSpawn -- launch state machine, state 0 (ROM 0x278f). Grounding: [seen].
 *
 * WHAT IT IS
 *   The arrow/rope launch is a small five-state machine that fires the arrow object across the
 *   playfield and, off the back of it, seeds the "hunter" attackers. Each frame the launch driver
 *   dispatches one handler chosen by the launch-state selector LAUNCH_STATE (0x8f30). This is the
 *   state-0 handler: it arms the launch exactly once, waits (by returning early) until the arrow has
 *   risen and both hunter-target slots are clear, then advances the machine to state 1 and paints the
 *   first arrow tile on screen.
 *
 * ROLE IN THE MACHINE
 *   Gatekeeper and igniter for the whole launch sequence. Nothing downstream (the arrow animation in
 *   state 1, the hunter-record spawn in state 2, the post-spawn hold in state 3) runs until this
 *   handler has both raised the launch-armed flag and cleared the arrow/target gates below.
 *
 * LIVE-OUT (what it leaves in memory)
 *   - LAUNCH_ARMED_FLAG (0x8f3f): raised to 1 once the arm preconditions hold.
 *   - LAUNCH_ARM_LATCH  (0x8f20): bumped on the lane-spawn arm path, or refreshed from its seed.
 *   - LAUNCH_STATE      (0x8f30): incremented, handing the next frame to the state-1 handler.
 *   - LAUNCH_FLIP_COUNTDOWN (0x892f): reseeded to time the arrow's flapping-tile animation.
 *   - LAUNCH_HUD_TILE   (0x8508): lit while the game is idle, else left as-is.
 *   - the 2x2 launch-arrow tile square at LAUNCH_TILE_VRAM (0x84a7) in video RAM.
 *   The tail tile-blit also leaves HL advanced past the written square as a side effect; the launch
 *   driver that runs this handler does not read it.
 */
export function armLaunchAndAdvanceToHunterSpawn(m) {
  const { mem8 } = m;

  // -- Arm the launch flag once --
  // Only run the arming logic while the launch is not already armed; once LAUNCH_ARMED_FLAG (0x8f3f)
  // is set this whole block is skipped and every later frame falls straight through to the gates.
  if (mem8[LAUNCH_ARMED_FLAG] === 0) {
    let checkStage = true;
    // Arm path A -- a lane-spawn sequence is still running (LANE_SPAWN_COUNTDOWN 0x8d75 nonzero) and
    // the arm latch LAUNCH_ARM_LATCH (0x8f20) has not yet been claimed. Bump the latch to record that
    // this frame armed via the lane path, and arm unconditionally (skip the stage test).
    if (mem8[LANE_SPAWN_COUNTDOWN] !== 0 && mem8[LAUNCH_ARM_LATCH] === 0) {
      mem8[LAUNCH_ARM_LATCH] = mem8[LAUNCH_ARM_LATCH] + 1;
      checkStage = false;
    }
    // Arm path B -- no lane sequence (or the latch already claimed): arm only on the stage cadence.
    // The stage countdown STAGE_COUNTDOWN (0x8901) must be nonzero and an exact multiple of eight;
    // any other value returns without arming, so the launch waits for the next eight-step boundary.
    if (checkStage) {
      const stage = mem8[STAGE_COUNTDOWN];
      if (stage === 0) return;
      if ((stage & 0x07) !== 0) return;
    }
    mem8[LAUNCH_ARMED_FLAG] = 0x01;
  }

  // -- Gate on arrow height and the two hunter-hit bits --
  // Hold state 0 until the arrow object has risen far enough: ARROW_Y (0x8ab4), the Y field of the
  // arrow actor record, must have reached the gate value. Below it, return and try again next frame.
  if (mem8[ARROW_Y] < ARROW_Y_GATE) return;
  // Also hold if either hunter-target slot is already flagged hit -- the I-parity pair of target
  // records ENEMY_TARGET_REC0 (0x8c90) and ENEMY_TARGET_REC1 (0x8ca8). A set hit bit means a target
  // is still being resolved, so the launch must not advance and re-fire over it.
  if (mem8[ENEMY_TARGET_REC0] & HIT_BIT) return;
  if (mem8[ENEMY_TARGET_REC1] & HIT_BIT) return;

  // -- Advance the state and refresh its fields --
  // All gates clear: step the launch state machine to state 1 (the arrow-animate / target-seed
  // handler) and reload the tile-flip countdown LAUNCH_FLIP_COUNTDOWN (0x892f) that state 1 drains to
  // time the arrow's flapping-tile frames.
  mem8[LAUNCH_STATE] = mem8[LAUNCH_STATE] + 1;
  mem8[LAUNCH_FLIP_COUNTDOWN] = FLIP_RESEED;

  // Light the status-panel launch cell LAUNCH_HUD_TILE (0x8508) only while the game is idle: the
  // in-play gate GAME_ACTIVE_FLAG (0x8806) is clear AND the launch is genuinely active (the play-mode
  // latch PLAY_MODE_LATCH 0x8f50 OR the launch-armed flag is set). During a live game the cell is
  // left untouched here.
  if (mem8[GAME_ACTIVE_FLAG] === 0 && (mem8[PLAY_MODE_LATCH] | mem8[LAUNCH_ARMED_FLAG]) !== 0) {
    mem8[LAUNCH_HUD_TILE] = HUD_LIT_TILE;
  }

  // Refresh the arm latch from its seed: if LAUNCH_ARM_LATCH_SEED (0x8d7a) is nonzero, copy it into
  // the arm latch LAUNCH_ARM_LATCH (0x8f20), re-blocking a re-arm for the rest of this launch.
  const seed = mem8[LAUNCH_ARM_LATCH_SEED];
  if (seed !== 0) mem8[LAUNCH_ARM_LATCH] = seed;

  // Paint the first arrow frame: copy the 4-byte 2x2 tile block at LAUNCH_TILE_SRC (0x2d51) into the
  // video-RAM square anchored at LAUNCH_TILE_VRAM (0x84a7).
  return blit2x2TileBlock(m, LAUNCH_TILE_VRAM, LAUNCH_TILE_SRC);
}
