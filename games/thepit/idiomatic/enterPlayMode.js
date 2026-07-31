// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterPlayMode — switch the game into active play and seed the per-round counters.  ROM 0x03be.
 *
 * This is the "start playing" arm of the top-level state dispatcher: its caller
 * forks between showing the credit screen and entering play, and picks this when it
 * is time to play. It flips the game-mode byte to the play value, seeds the counters
 * the round runs on, quiets and reconfigures the cabinet, then hands off to the round
 * (re)init that finishes the setup and drops into the main game loop.
 *
 * The one store that actually starts play is the game-mode byte: the main loop runs
 * the per-frame gameplay tick ONLY while that byte holds the play value, so writing it
 * here is what turns the machine into "playing". Everything else primes the round the
 * loop is about to run — the demo's starting steering heading, the gameplay tick's
 * phase counters, the idle-delay base the loop paces itself from — and the two setup
 * calls mute audio while the screen is rebuilt and commit the cabinet DIP settings.
 *
 * It reads no register input and returns nothing a caller consumes: its whole effect
 * is the seeded work RAM (plus the audio/flip control lines the setup calls drive).
 *
 * Memory-equivalent to the frozen oracle — equivalence-03be.test.js.
 * GATE:     crafted-entry — the real boot dispatch of 0x03be (reached ~frame 693 as
 *           attract cycles into the play demo), RAM-EQUAL to the oracle, plus a DIP
 *           sweep (0..127, top bit clear) and a garbage-prefill entry proving the
 *           seeds are unconditional. The tail hands into initRoundAndEnterMainLoop, which paints the
 *           board and falls into the never-returning main loop, so both arms run the
 *           real chain under one shared watchdog hook (drain paintScreen's frame-waits;
 *           stop at the main loop's entry). Teeth: wrong play value / a dropped seed.
 * LIVE-OUT: memory-only — the seeded work-RAM counters; the audio-enable and
 *           flip-screen control lines are driven for the live game but sit outside the
 *           RAM diff. No register or flag is read by the round init it hands off to.
 * NAMES:    GAME_STATE (0x8001), DEMO_STEER_DIR (0x801b), ACTIVE_PLAYER (0x8002), and the
 *           idle-delay base LOOP_DELAY_BASE (0x804e) from ram.js; the gameplay-tick phase
 *           countdown DEMO_STEER_SERVICE_TIMER (0x800b) / index DEMO_STEER_BAND_HINT (0x800c), and
 *           PLAYER1_LEVEL_BACKUP (0x8029) is the demo's saved Player-1 LEVEL backup — a player-record backup.
 *           disableSound / applyDipSwitches are called directly; the round-init
 *           tail (initRoundAndEnterMainLoop, 0x031a) is kept as an m.call boundary — it falls into the
 *           never-returning main loop, so it stays a stubbable/boundable registry boundary.
 */

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
} from "./ram.js";

export function* enterPlayMode(m) {
  const { mem8 } = m;

  // Enter play: the main loop runs the per-frame gameplay tick only while the
  // game-mode byte holds the play value (4).
  mem8[GAME_STATE] = 4;

  // Seed the demo's starting steering heading to a single direction (the movement
  // dispatcher reads this in place of the joystick during the attract demo).
  mem8[DEMO_STEER_DIR] = 1;

  // Arm the secondary game-state byte, then seed the demo's saved Player-1 LEVEL backup
  // to 3 so the attract demo runs at level 3 (loadPlayerState promotes it to the working LEVEL).
  mem8[ACTIVE_PLAYER] = 1;
  mem8[PLAYER1_LEVEL_BACKUP] = 3;

  // Quiet the audio while the round is set up, then commit the cabinet DIP settings
  // into the gameplay-parameter block (order matters: the DIP decode reads the
  // secondary game-state byte set just above for its flip-screen fold).
  disableSound(m);
  applyDipSwitches(m);

  // Idle-delay base: the round init derives the main loop's per-frame pacing delay
  // from this minus the current level, so it overrides whatever the DIP decode just
  // left in this cell.
  mem8[LOOP_DELAY_BASE] = 12;

  // Seed the gameplay tick's phasing: countdown to 1, phase index back to 0.
  mem8[DEMO_STEER_SERVICE_TIMER] = 1;
  mem8[DEMO_STEER_BAND_HINT] = 0;

  // Hand off to the round (re)init, which finishes setting up the round and falls
  // through into the main game loop; it never returns here.
  // m.call boundary: tail hand-off into the never-returning round init (initRoundAndEnterMainLoop 0x031a,
  // which falls into mainLoop); a direct call is behaviorally identical and a terminal-test
  // would be a fragile artifact.
  return yield* m.call(0x031a);
}
