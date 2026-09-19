// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterPlayMode — switch the game into active play and seed the per-round counters.
 * The "start playing" arm of the top-level state dispatcher, picked when it is time to play. The
 * one store that starts play is GAME_STATE, set to the play value (4): the main loop runs the
 * per-frame gameplay tick only while it holds that value. Everything else primes the round the loop
 * is about to run — the demo's starting steering heading (DEMO_STEER_DIR), the tick's phase counters
 * (DEMO_STEER_SERVICE_TIMER / DEMO_STEER_BAND_HINT), the idle-delay base (LOOP_DELAY_BASE), and the
 * demo's Player-1 LEVEL backup — while the two setup calls mute audio and commit the DIP settings.
 * It reads no register input; its whole effect is the seeded work RAM plus the audio/flip lines.
 */

import { initRoundAndEnterMainLoop } from "./initRoundAndEnterMainLoop.js";
import { disableSound } from "./disableSound.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import {
  GAME_STATE,
  DEMO_STEER_DIR,
  ACTIVE_PLAYER,
  LOOP_DELAY_BASE,
  DEMO_STEER_SERVICE_TIMER,
  DEMO_STEER_BAND_HINT,
  PLAYER1_LEVEL_BACKUP,
} from "./names.js";

export function* enterPlayMode(m) {
  const { mem8 } = m;

  // Enter play: the main loop runs the gameplay tick only while the game-mode byte holds 4.
  mem8[GAME_STATE] = 4;

  // Seed the demo's starting steering heading (read in place of the joystick during attract).
  mem8[DEMO_STEER_DIR] = 1;

  // Arm the secondary game-state byte and seed the demo's Player-1 LEVEL backup to 3.
  mem8[ACTIVE_PLAYER] = 1;
  mem8[PLAYER1_LEVEL_BACKUP] = 3;

  // Quiet audio during setup, then commit the DIP settings (the decode reads the byte set above).
  disableSound(m);
  applyDipSwitches(m);

  // Idle-delay base: the round init derives the loop's pacing from this minus the current level.
  mem8[LOOP_DELAY_BASE] = 12;

  // Seed the gameplay tick's phasing: countdown to 1, phase index back to 0.
  mem8[DEMO_STEER_SERVICE_TIMER] = 1;
  mem8[DEMO_STEER_BAND_HINT] = 0;

  // Hand off to the round (re)init, which falls into the main game loop and never returns here.
  return yield* initRoundAndEnterMainLoop(m);
}
