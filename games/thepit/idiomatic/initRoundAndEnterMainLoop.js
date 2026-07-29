// SPDX-License-Identifier: GPL-3.0-only
/**
 * initRoundAndEnterMainLoop — final per-round (re)init: run the pre-play setup chain, derive the main
 * loop's per-frame pacing delay, clear the frame counter and the first sound slot,
 * then hand off into the main game loop.  ROM 0x031a.
 *
 * Reached when a round is about to begin (from entering play mode and from the
 * round-setup animation loop). In order it:
 *   1. Requests the round-start sound.
 *   2. Restores the active player's saved record (level, counters, score).
 *   3. Paints the whole board screen.
 *   4. During real play — game mode 1 or 2, not the attract demo — draws the players
 *      HUD panel.
 *   5. Seeds the tracked object's start state, reseeds the terrain-column reveal
 *      animation, and resets the reaction state machine to idle.
 *   6. Derives the main loop's per-frame idle delay as (LOOP_DELAY_BASE) minus the current
 *      LEVEL — read after the setup chain, since restoring the player record sets the
 *      level — so higher levels pace the loop faster.
 *   7. Clears the frame counter and the first sound-command slot.
 *   8. Falls through into the main game loop, which re-seats the stack and runs
 *      forever, so this routine never returns.
 *
 * The role straddles round setup and the main-loop on-ramp, and its round-lifecycle
 * siblings keep neutral address names for the same reason (a single verb would over-
 * or under-claim), so this one does too.
 *
 * Memory-equivalent to the frozen oracle — equivalence-031a.test.js.
 * GATE:     crafted-harness — run from the real captured boot dispatch. The main loop it
 *           falls into (mainLoop, 0x0348) never returns, so both arms run the REAL loop
 *           under one shared watchdog hook: each watchdog read drains paintScreen's per-
 *           frame countdown so its frame-waits terminate, and the first read the loop makes
 *           with the countdown already drained (its pass top, which the setup frame-waits
 *           never do) throws to stop both sides at the loop's entry — before it does any
 *           per-frame work, the same point the old no-op stub compared at. Diffed over
 *           observable RAM (the dead stack scratch below the entry SP excluded). Also run
 *           with game mode crafted to 1 to cover the players-HUD arm. Teeth: a wrong pacing
 *           delay, a skipped flag clear, and a wrongly-drawn players HUD.
 * LIVE-OUT: memory-only — the setup chain's writes, the pacing delay at MAIN_LOOP_DELAY, and
 *           the two cleared bytes. No register is read back — it exits into a forever loop
 *           that re-establishes its own state.
 * NAMES:    GAME_STATE (0x8001), LEVEL (0x8028), SOUND_RING (0x8020), PLAY_PHASE_COUNTER
 *           (0x8010), the pacing base LOOP_DELAY_BASE (0x804e) and the delay cell
 *           MAIN_LOOP_DELAY (0x8011) from ram.js.
 *
 * PURPOSE [guess]: exact boundary; straddles setup + on-ramp.
 */

import { requestSound6 } from "./requestSound6.js";
import { loadPlayerState } from "./loadPlayerState.js";
import { paintScreen } from "./paintScreen.js";
import { drawPlayerLabel } from "./drawPlayerLabel.js";
import { seedObjectStartState } from "./seedObjectStartState.js";
import { reseedColumnAnimation } from "./reseedColumnAnimation.js";
import { resetReactionState } from "./resetReactionState.js";
import { GAME_STATE, LEVEL, SOUND_RING, PLAY_PHASE_COUNTER, MAIN_LOOP_DELAY, LOOP_DELAY_BASE } from "./ram.js";

export function initRoundAndEnterMainLoop(m) {
  const { mem8 } = m;

  // Pre-play setup chain: round-start sound, restore the player's record, paint the board.
  requestSound6(m);
  loadPlayerState(m);
  paintScreen(m);

  // Real play (game mode 1 or 2, not the attract demo) draws the players HUD panel.
  const mode = mem8[GAME_STATE];
  if (mode === 1 || mode === 2) drawPlayerLabel(m);

  // Seed the per-round object start state, the terrain-column reveal, and the reaction machine.
  seedObjectStartState(m);
  reseedColumnAnimation(m);
  resetReactionState(m);

  // Main loop's per-frame idle delay: the pacing base minus the current level, read here
  // (after restoring the player record set the level) so higher levels pace faster.
  mem8[MAIN_LOOP_DELAY] = mem8[LOOP_DELAY_BASE] - mem8[LEVEL];

  // Clear the first sound-command slot and the frame counter before play begins.
  mem8[SOUND_RING] = 0;
  mem8[PLAY_PHASE_COUNTER] = 0;

  // Hand off into the main game loop; it re-seats the stack and runs forever.
  // m.call boundary: tail hand-off into the never-returning mainLoop (0x0348); a direct
  // call is behaviorally identical and a terminal-test would be a fragile artifact.
  return m.call(0x0348);
}
