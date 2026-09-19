// SPDX-License-Identifier: GPL-3.0-only
/**
 * initRoundAndEnterMainLoop — final per-round (re)init: run the pre-play setup chain, derive the
 * main loop's per-frame pacing delay, clear the frame counter and the first sound slot, then
 * hand off into the main game loop. Reached when a round is about to begin (from entering play
 * mode and from the round-setup animation loop). It requests the round-start sound, restores the
 * active player's saved record, paints the board, and during real play (GAME_STATE marking player
 * one or two, not the attract demo) draws the players HUD panel. It then seeds the object start
 * state, the terrain-column reveal and the reaction machine, sets MAIN_LOOP_DELAY to LOOP_DELAY_BASE
 * minus LEVEL (read after the record restore set the level, so higher levels pace faster), clears
 * the first SOUND_RING slot and PLAY_PHASE_COUNTER, then falls into the never-returning main loop.
 * The exact boundary straddles setup and the on-ramp, so the name stays neutral.
 */

import { mainLoop } from "./mainLoop.js";
import { requestSound6 } from "./requestSound6.js";
import { loadPlayerState } from "./loadPlayerState.js";
import { paintScreen } from "./paintScreen.js";
import { drawPlayerLabel } from "./drawPlayerLabel.js";
import { seedObjectStartState } from "./seedObjectStartState.js";
import { seedMountainErosion } from "./seedMountainErosion.js";
import { resetReactionState } from "./resetReactionState.js";
import { GAME_STATE, LEVEL, SOUND_RING, PLAY_PHASE_COUNTER, MAIN_LOOP_DELAY, LOOP_DELAY_BASE } from "./names.js";

export function* initRoundAndEnterMainLoop(m) {
  const { mem8 } = m;

  // Pre-play setup chain: round-start sound, restore the player's record, paint the board.
  requestSound6(m);
  loadPlayerState(m);
  yield* paintScreen(m);

  // Real play (game mode 1 or 2, not the attract demo) draws the players HUD panel.
  const mode = mem8[GAME_STATE];
  if (mode === 1 || mode === 2) drawPlayerLabel(m);

  // Seed the per-round object start state, the terrain reveal, and the reaction machine.
  seedObjectStartState(m);
  seedMountainErosion(m);
  resetReactionState(m);

  // Idle delay = pacing base minus level (read after the record restore set the level).
  mem8[MAIN_LOOP_DELAY] = mem8[LOOP_DELAY_BASE] - mem8[LEVEL];

  // Clear the first sound slot and the frame counter before play begins.
  mem8[SOUND_RING] = 0;
  mem8[PLAY_PHASE_COUNTER] = 0;

  // Hand off into the never-returning main loop; it re-seats the stack and runs forever.
  return yield* mainLoop(m);
}
